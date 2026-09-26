'use client';

import { NEWSLETTER_CONSENT_TEXT } from '@/lib/newsletter-consent';
import { trackMetric } from '@/lib/product-metrics';
import { useLanguage } from '@/components/LanguageProvider';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TIPI_SPOT, TIPI_SPOT_SELEZIONABILI, OSTACOLI, DIFFICOLTA, CONDIZIONI, DEBOUNCE_USERNAME_MS, GPS_TIMEOUT_MS } from '@/lib/constants';
import { reverseGeocode } from '@/lib/geocoding';
import type { Ostacolo, SpotType, SpotMapPin } from '@/lib/types';
import PhotoUpload from './PhotoUpload';
import { useUser } from '@/hooks/useUser';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { signIn, signUp, checkUsername, resetPassword } from '@/lib/auth-client';
import { createPhotoUploadBatch } from '@/lib/photo-upload-batch';

interface AddSpotModalProps {
  open:        boolean;
  onClose:     () => void;
  initialLat?: number;
  initialLon?: number;
}

type Step    = 'posizione' | 'foto' | 'dettagli' | 'successo';
type AuthTab = 'accedi' | 'registrati';

const STEPS: Step[] = ['posizione', 'foto', 'dettagli'];
const STEP_LABEL: Record<Step, string> = {
  posizione: '1 — Posizione',
  foto:      '2 — Foto',
  dettagli:  '3 — Dettagli',
  successo:  '',
};
const STEP_LABEL_EN: Record<Step, string> = { posizione: '1 — Location', foto: '2 — Photos', dettagli: '3 — Details', successo: '' };

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
  borderRadius: 4, color: 'var(--bone)', fontFamily: 'var(--font-mono)',
  fontSize: 15, padding: '10px 12px', outline: 'none',
};
const lbl: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)',
  textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6,
};

/* ── Estrai coordinate da URL Google Maps, Apple Maps, DMS iPhone o stringa "lat, lon" ── */
function parseCoordInput(raw: string): { lat: number; lon: number } | null {
  // Rimuovi parentesi, virgolette e spazi extra — gestisce "(lat, lon)", "[lat, lon]" ecc.
  const s = raw.trim().replace(/^[\s([\]"']+|[\s)\]"']+$/g, '').trim();

  // Google Maps URL con @lat,lon
  const m1 = s.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (m1) return { lat: parseFloat(m1[1]), lon: parseFloat(m1[2]) };

  // ?q=lat,lon (solo numeri)
  const m2 = s.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m2) return { lat: parseFloat(m2[1]), lon: parseFloat(m2[2]) };

  // ?ll=lat,lon or ?coordinate=lat,lon (Apple Maps)
  const m3 = s.match(/[?&](?:ll|coordinate)=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (m3) return { lat: parseFloat(m3[1]), lon: parseFloat(m3[2]) };

  // DMS iPhone: 45°27'35.2"N 11°00'42.1"E  oppure  45°27'35"N, 11°0'42"E
  const dms = parseDMS(s);
  if (dms) return dms;

  // iPhone decimal con virgola italiana: "46,66343° N, 11,15918° E"
  const mIT = s.match(/(\d+[,.]?\d*)\s*°?\s*([NSns])\s*[,;\s]+\s*(\d+[,.]?\d*)\s*°?\s*([EWew])/);
  if (mIT) {
    let lat = parseFloat(mIT[1].replace(',', '.'));
    let lon = parseFloat(mIT[3].replace(',', '.'));
    if (mIT[2].toUpperCase() === 'S') lat = -lat;
    if (mIT[4].toUpperCase() === 'W') lon = -lon;
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) return { lat, lon };
  }

  // "lat, lon" | "lat lon" | "lat;lon" — anche con virgola italiana (46,66 11,15)
  // Normalizza virgole italiane se ci sono lettere o doppia virgola
  const normalized = s.replace(/(\d),(\d)/g, '$1.$2');
  const m4 = normalized.match(/^(-?\d+\.?\d*)[,;\s]+(-?\d+\.?\d*)$/);
  if (m4) return { lat: parseFloat(m4[1]), lon: parseFloat(m4[2]) };

  return null;
}

/* ── Parse coordinate in formato DMS (gradi minuti secondi) ── */
function parseDMS(input: string): { lat: number; lon: number } | null {
  // Match pattern: 45°27'35.2"N 11°00'42.1"E (with various separators)
  const re = /(\d+)[°]\s*(\d+)[''′]\s*(\d+(?:\.\d+)?)[""″]?\s*([NSns])\s*[,;\s]+\s*(\d+)[°]\s*(\d+)[''′]\s*(\d+(?:\.\d+)?)[""″]?\s*([EWew])/;
  const m = input.match(re);
  if (!m) return null;

  let lat = parseInt(m[1]) + parseInt(m[2]) / 60 + parseFloat(m[3]) / 3600;
  let lon = parseInt(m[5]) + parseInt(m[6]) / 60 + parseFloat(m[7]) / 3600;

  if (m[4].toUpperCase() === 'S') lat = -lat;
  if (m[8].toUpperCase() === 'W') lon = -lon;

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  return { lat, lon };
}

/* ── Mappa preview con pin draggabile (Leaflet) ── */
function LocationMapPicker({
  lat, lon, onPick, height = 240,
}: {
  lat: number | null;
  lon: number | null;
  onPick: (lat: number, lon: number) => void;
  height?: number;
}) {
  const { text } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<import('leaflet').Map | null>(null);
  const markerRef    = useRef<import('leaflet').Marker | null>(null);
  const onPickRef    = useRef(onPick);
  useEffect(() => { onPickRef.current = onPick; });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;

      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        iconUrl:       '/leaflet/marker-icon.png',
        shadowUrl:     '/leaflet/marker-shadow.png',
      });

      // Senza coordinate note: vista mondo (world-wide, niente Italy-first)
      const center: [number, number] = lat != null ? [lat, lon!] : [20, 0];
      const zoom = lat != null ? 15 : 2;

      const map = L.map(containerRef.current!, { center, zoom, zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, className: 'osm-tiles',
      }).addTo(map);
      mapRef.current = map;

      const addMarker = (eLat: number, eLon: number) => {
        if (markerRef.current) {
          markerRef.current.setLatLng([eLat, eLon]);
        } else {
          const m = L.marker([eLat, eLon], { draggable: true }).addTo(map);
          markerRef.current = m;
          m.on('dragend', () => {
            const p = m.getLatLng();
            onPickRef.current(p.lat, p.lng);
          });
        }
        onPickRef.current(eLat, eLon);
      };

      if (lat != null && lon != null) addMarker(lat, lon);
      map.on('click', (e) => addMarker(e.latlng.lat, e.latlng.lng));
    });

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat == null || lon == null) return;
    map.flyTo([lat, lon], 16, { duration: 0.6 });
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else {
      import('leaflet').then((L) => {
        if (!mapRef.current) return;
        const m = L.marker([lat, lon], { draggable: true }).addTo(mapRef.current);
        markerRef.current = m;
        m.on('dragend', () => {
          const p = m.getLatLng();
          onPickRef.current(p.lat, p.lng);
        });
      });
    }
  }, [lat, lon]);

  return (
    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--gray-600)' }}>
      <div ref={containerRef} style={{ width: '100%', height }} />
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(10,10,10,0.82)', borderRadius: 4, padding: '3px 10px',
        fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--orange)',
        pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        {lat != null ? `📍 ${lat.toFixed(5)}, ${lon!.toFixed(5)}` : text("Clicca sulla mappa per posizionare il pin", "Tap the map to place the pin")}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
export default function AddSpotModal({ open, onClose, initialLat, initialLon }: AddSpotModalProps) {
  const { text } = useLanguage();
  const user      = useUser();
  const isLoading = user === undefined;

  const [step, setStep] = useState<Step>('posizione');
  const [lat,  setLat]  = useState<number | null>(initialLat ?? null);
  const [lon,  setLon]  = useState<number | null>(initialLon ?? null);

  /* Step 1 */
  /* Parte già su 'gps': chi aggiunge uno spot quasi sempre ci sta davanti.
     La schermata "come vuoi indicare la posizione?" chiedeva una decisione a
     uno in piedi sullo spot con la bici in mano — la risposta era ovvia. Il
     percorso manuale resta, in fondo e in piccolo. */
  const [locMode,     setLocMode]     = useState<'gps' | 'coords' | null>('gps');
  /* true quando il browser ha già il permesso: possiamo leggere la posizione
     senza far comparire nessun dialog, quindi zero tap. */
  const [geoPreGranted, setGeoPreGranted] = useState<boolean | null>(null);
  const [coordInput,  setCoordInput]  = useState('');
  const [coordError,  setCoordError]  = useState<string | null>(null);
  const [gpsState,    setGpsState]    = useState<'idle' | 'loading' | 'ok' | 'error' | 'denied' | 'timeout'>('idle');

  /* Step 2 — photos + pre-upload */
  const [photos, setPhotos] = useState<File[]>([]);
  const [preUploadedUrls, setPreUploadedUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const photoUploadBatch = useRef(createPhotoUploadBatch<File>());

  useEffect(() => {
    if (!open) {
      photoUploadBatch.current.invalidate();
      setPreUploadedUrls([]); setUploading(false); setUploadError(null);
    }
    const batch = photoUploadBatch.current;
    return () => batch.invalidate();
  }, [open]);

  const metricOpen = useRef(false);
  useEffect(() => {
    if (open && !metricOpen.current) trackMetric('contribution_open', 'add');
    metricOpen.current = open;
  }, [open]);

  /* Compress image client-side before upload (5MB → ~300KB) */
  const compressImage = useCallback(async (file: File): Promise<Blob> => {
    const MAX_DIM = 1920;
    const QUALITY = 0.8;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(blob ?? file),
          'image/jpeg',
          QUALITY
        );
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => resolve(file); // fallback: send original
      img.src = URL.createObjectURL(file);
    });
  }, []);

  /* Pre-upload photos as soon as selected — runs in background while user fills step 3 */
  const handlePhotosChange = useCallback(async (files: File[]) => {
    setPhotos(files);
    photoUploadBatch.current.invalidate();
    setPreUploadedUrls([]); setUploading(false); setUploadError(null);
    if (!user || files.length === 0) return;

    setUploading(true);
    const sessionRequest = Promise.resolve().then(() => supabaseBrowser().auth.getSession());
    const result = await photoUploadBatch.current.run(files, async file => {
      const { data: { session } } = await sessionRequest;
      if (!session?.access_token) return null;
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append('file', new File([compressed], file.name, { type: 'image/jpeg' }));
      fd.append('access_token', session.access_token);
      fd.append('purpose', 'general');
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const j = await res.json();
      return res.ok && j.ok ? j.url : null;
    });
    if (!result) return; // The selection changed or the dialog closed while uploading.
    setUploading(false);
    setPreUploadedUrls(result.urls);
    if (result.failed) setUploadError(text("Caricamento foto incompleto. I file sono ancora selezionati: riprova oppure invia lo spot per ricaricarli tutti.", "Some photos did not upload. Your files are still selected: retry, or submit the spot to upload them all again."));
  }, [user, compressImage, text]);

  /* Step 3 */
  const [name,        setName]        = useState('');
  const [type,        setType]        = useState<SpotType | ''>('');
  /* Cosa c'e' sullo spot. Separato dal tipo perche' un bank puo' stare contro
     un muro in centro o dentro un park: l'ostacolo non dice dove sei. */
  const [ostacoli,    setOstacoli]    = useState<Ostacolo[]>([]);
  const [description, setDescription] = useState('');
  const [notes,       setNotes]       = useState('');
  const [difficulty,  setDifficulty]  = useState<string>('');

  /* Submit */
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  /* Auth */
  const [authTab,      setAuthTab]      = useState<AuthTab>('accedi');
  const [authError,    setAuthError]    = useState<string | null>(null);
  const [authLoading,  setAuthLoading]  = useState(false);
  const [authDone,     setAuthDone]     = useState<'ok' | 'confirm_email' | null>(null);
  const [regUsername,  setRegUsername]  = useState('');
  const [regEmail,     setRegEmail]     = useState('');
  const [regPassword,  setRegPassword]  = useState('');
  const [usernameOk,   setUsernameOk]   = useState<boolean | null>(null);
  const [checkingUn,   setCheckingUn]   = useState(false);
  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [resetSent,     setResetSent]     = useState(false);
  const [resetLoading,  setResetLoading]  = useState(false);
  const [ageConfirmed2, setAgeConfirmed2] = useState(false);
  const [newsletterMessage, setNewsletterMessage] = useState('');
  const [newsletterOptIn2, setNewsletterOptIn2] = useState(false);

  /* Nearby spots — duplicate detection */
  interface NearbySpot { id: string; slug: string; name: string; type: SpotType; city?: string; condition: string; distance: number; spot_photos?: { url: string; position: number }[] }
  const [nearbySpots, setNearbySpots] = useState<NearbySpot[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyDismissed, setNearbyDismissed] = useState(false);

  /* Reverse geocode → auto-popola città + paese */
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const fetchCity = useCallback(async (eLat: number, eLon: number) => {
    try {
      const geo = await reverseGeocode(eLat, eLon);
      if (geo.city) setCity(geo.city);
      setCountry(geo.country ?? '');
      setCountryCode(geo.countryCode ?? '');
    } catch { /* silent */ }
  }, []);

  /* Sync initialLat/Lon */
  useEffect(() => {
    if (initialLat != null && initialLon != null) {
      setLat(initialLat); setLon(initialLon); setGpsState('ok');
      fetchCity(initialLat, initialLon);
    }
  }, [initialLat, initialLon, fetchCity]);

  /* Fetch nearby spots when coords are set */
  useEffect(() => {
    if (lat == null || lon == null) { setNearbySpots([]); setNearbyDismissed(false); return; }
    setNearbyLoading(true);
    setNearbyDismissed(false);
    fetch(`/api/spots/nearby?lat=${lat}&lon=${lon}&radius=150`)
      .then(r => r.json())
      .then(j => { if (j.ok) setNearbySpots(j.data ?? []); })
      .catch(() => {})
      .finally(() => setNearbyLoading(false));
  }, [lat, lon]);

  /* Reset */
  const handleClose = useCallback(() => {
    photoUploadBatch.current.invalidate();
    setStep('posizione');
    setLat(initialLat ?? null); setLon(initialLon ?? null); setCity(''); setCountry(''); setCountryCode('');
    /* 'gps' e non null: il selettore di metodo non esiste più, quindi null
       lascerebbe il passo posizione completamente vuoto alla riapertura. */
    setLocMode('gps');
    setGeoPreGranted(null); // ricontrolla il permesso alla prossima apertura
    setCoordInput(''); setCoordError(null);
    setGpsState('idle');
    setPhotos([]);
    setName(''); setType(''); setOstacoli([]); setDescription(''); setNotes('');
    setError(null); setSubmitting(false);
    setNearbySpots([]); setNearbyDismissed(false);
    setPreUploadedUrls([]); setUploading(false); setUploadError(null);
    setAuthError(null); setAuthDone(null);
    setRegUsername(''); setRegEmail(''); setRegPassword('');
    setLoginEmail(''); setLoginPassword('');
    onClose();
  }, [initialLat, initialLon, onClose]);

  /* Parse input (URL o coordinate) — supporta anche link corti maps.app.goo.gl */
  const handleConfirmCoords = async () => {
    setCoordError(null);

    const trimmed = coordInput.trim();

    // Link corto Google Maps → risolvi server-side
    const isShortLink =
      trimmed.startsWith('https://maps.app.goo.gl/') ||
      trimmed.startsWith('https://goo.gl/maps/');

    if (isShortLink) {
      setCoordError(text("⏳ Risolvo il link…", "⏳ Opening the map link…"));
      try {
        const res = await fetch(`/api/resolve-gmaps?url=${encodeURIComponent(trimmed)}`);
        const json = await res.json();
        if (!json.ok) {
          setCoordError(json.error ?? text("Impossibile risolvere il link. Prova con le coordinate dirette.", "Could not read this link. Try entering the coordinates directly."));
          return;
        }
        setCoordError(null);
        setLat(json.lat); setLon(json.lon);
        fetchCity(json.lat, json.lon);
        return;
      } catch {
        setCoordError(text("Errore di rete. Prova con le coordinate dirette.", "Connection error. Try entering the coordinates directly."));
        return;
      }
    }

    // URL lungo o coordinate testuali
    const parsed = parseCoordInput(trimmed);
    if (!parsed) {
      setCoordError(text("Formato non riconosciuto. Incolla il link di Google Maps o scrivi \"lat, lon\".", "Format not recognised. Paste a Google Maps link or enter \"lat, lon\"."));
      return;
    }
    const { lat: pLat, lon: pLon } = parsed;
    if (pLat < -90 || pLat > 90 || pLon < -180 || pLon > 180) {
      setCoordError(text("Coordinate non valide.", "Invalid coordinates."));
      return;
    }
    setLat(pLat); setLon(pLon);
    fetchCity(pLat, pLon);
  };

  /* ── Permesso posizione: già concesso? ──
     Se il browser ha già il permesso possiamo leggere la posizione senza che
     compaia nessun dialog — quindi la prendiamo da soli e l'utente non tocca
     niente. Se NON è concesso non spariamo il dialog a sorpresa: chi se lo
     vede arrivare senza contesto tocca "Blocca" d'istinto, e il browser se lo
     ricorda per sempre. In quel caso mostriamo una riga di spiegazione e un
     bottone solo. */
  useEffect(() => {
    if (!open || geoPreGranted !== null) return;
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      setGeoPreGranted(false); // niente Permissions API (Safari vecchi) → chiediamo
      return;
    }
    let cancelled = false;
    navigator.permissions.query({ name: 'geolocation' as PermissionName })
      .then(res => { if (!cancelled) setGeoPreGranted(res.state === 'granted'); })
      .catch(() => { if (!cancelled) setGeoPreGranted(false); });
    return () => { cancelled = true; };
  }, [open, geoPreGranted]);

  /* Permesso già dato → posizione presa da sola, zero tap. */
  useEffect(() => {
    if (!open) return;
    if (geoPreGranted !== true) return;
    if (locMode !== 'gps') return;
    if (lat != null || lon != null) return;
    if (gpsState !== 'idle') return;
    getGPS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, geoPreGranted, locMode, lat, lon, gpsState]);

  /* GPS */
  const getGPS = () => {
    if (!navigator.geolocation) { setGpsState('error'); return; }
    setGpsState('loading');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude); setLon(longitude); setGpsState('ok');
        navigator.vibrate?.(15);
        fetchCity(latitude, longitude);
      },
      (err) => {
        if (err.code === 1) setGpsState('denied');       // utente ha negato
        else if (err.code === 3) setGpsState('timeout'); // timeout
        else setGpsState('error');                        // non disponibile
      },
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS }
    );
  };

  /* Submit */
  const handleSubmit = async () => {
    if (!user || !name.trim() || !type || lat == null || lon == null) return;
    setSubmitting(true); setError(null);
    try {
      const { data: { session } } = await supabaseBrowser().auth.getSession();
      if (!session?.access_token) {
        setError(text("Sessione scaduta. Chiudi il modal, ricarica la pagina e riprova.", "Your sign-in expired. Close this window, reload the page and try again."));
        return;
      }
      // Only a complete upload of this exact selection can replace its files.
      const photoUrls = photoUploadBatch.current.urlsFor(photos);

      let res: Response;
      if (photoUrls) {
        // Fast path: photos already uploaded, just send URLs
        res = await fetch('/api/submit-spot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(), type, lat, lon,
            ostacoli,
            city: city || undefined,
            country: country || undefined,
            country_code: countryCode || undefined,
            description: description || undefined,
            guardians: notes || undefined,
            difficulty: difficulty || undefined,
            photo_urls: photoUrls,
            access_token: session.access_token,
          }),
        });
      } else {
        // Fallback: send files in FormData
        const fd = new FormData();
        fd.append('data', JSON.stringify({
          name: name.trim(), type, lat, lon,
          ostacoli,
          city: city || undefined,
          country: country || undefined,
          country_code: countryCode || undefined,
          description: description || undefined,
          guardians: notes || undefined,
          difficulty: difficulty || undefined,
          access_token: session.access_token,
        }));
        photos.forEach((p, i) => fd.append(`photo_${i}`, p));
        res = await fetch('/api/submit-spot', { method: 'POST', body: fd });
      }
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? text("Errore durante l'invio.", "Could not submit the spot."));
      navigator.vibrate?.([30, 60, 30]);
      trackMetric('contribution_sent', 'add');
      setStep('successo');
    } catch (err) {
      setError(err instanceof Error ? err.message : text("Errore sconosciuto. Riprova.", "Something went wrong. Try again."));
    } finally { setSubmitting(false); }
  };

  /* Auth handlers */
  let unDebounce: ReturnType<typeof setTimeout>;
  const onUsernameChange = (val: string) => {
    const clean = val.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);
    setRegUsername(clean); setUsernameOk(null);
    clearTimeout(unDebounce);
    if (clean.length < 3) return;
    setCheckingUn(true);
    unDebounce = setTimeout(async () => {
      const free = await checkUsername(clean);
      setUsernameOk(free); setCheckingUn(false);
    }, DEBOUNCE_USERNAME_MS);
  };

  const handleSignUp = async () => {
    if (!regUsername || !regEmail || !regPassword) { setAuthError(text("Compila tutti i campi.", "Complete all fields.")); return; }
    if (regUsername.length < 3) { setAuthError(text("Username min 3 caratteri.", "Your username must be at least 3 characters.")); return; }
    if (regPassword.length < 6) { setAuthError(text("Password min 6 caratteri.", "Your password must be at least 6 characters.")); return; }
    if (!ageConfirmed2) { setAuthError(text("Devi confermare di avere almeno 14 anni.", "Confirm that you are at least 14 years old.")); return; }
    setAuthLoading(true); setAuthError(null);
    try { const result = await signUp(regEmail, regPassword, regUsername, { newsletter: newsletterOptIn2, over16: newsletterOptIn2, onNewsletterResult: setNewsletterMessage }); setAuthDone(result); }
    catch (e) { setAuthError(e instanceof Error ? e.message : text("Errore sconosciuto", "Something went wrong.")); }
    finally { setAuthLoading(false); }
  };

  const handleSignIn = async () => {
    if (!loginEmail || !loginPassword) { setAuthError(text("Inserisci email e password.", "Enter your email and password.")); return; }
    setAuthLoading(true); setAuthError(null);
    try { await signIn(loginEmail, loginPassword); }
    catch (e) { setAuthError(e instanceof Error ? e.message : text("Errore sconosciuto", "Something went wrong.")); }
    finally { setAuthLoading(false); }
  };

  if (!open) return null;

  const hasCoords  = lat != null && lon != null;
  const stepIndex  = STEPS.indexOf(step as Step);
  const progressPct = step === 'successo' ? 100 : ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <>
      <div onClick={handleClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 69, backdropFilter: 'none' }}
        aria-hidden />

      <div role="dialog" aria-modal aria-label={text("Aggiungi spot BMX", "Add a BMX spot")} style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--gray-800)', borderTop: '2px solid var(--orange)',
        borderRadius: '8px 8px 0 0', zIndex: 70,
        maxHeight: '92dvh', overflowY: 'auto', overscrollBehavior: 'contain',
        animation: 'slideUp 0.3s ease-out',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
      }}>
        <div className="bottom-sheet-handle" />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 14px', borderBottom: '1px solid var(--gray-700)' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--orange)', margin: 0 }}>{text("Aggiungi spot", "Add spot")}</h2>
            {user && step !== 'successo' && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', marginTop: 2 }}>
                {text(STEP_LABEL[step], STEP_LABEL_EN[step])}
              </div>
            )}
          </div>
          <button onClick={handleClose} className="btn-ghost" aria-label={text("Chiudi", "Close")} style={{ fontSize: 20 }}>✕</button>
        </div>

        {/* Progress */}
        {user && step !== 'successo' && (
          <div style={{ height: 3, background: 'var(--gray-700)' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--orange)', transition: 'width 0.3s ease-out' }} />
          </div>
        )}

        <div style={{ padding: '20px' }}>

          {newsletterMessage && <p role="status">{newsletterMessage}</p>}
          {/* Loading */}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: 'var(--font-mono)', color: 'var(--gray-400)' }}>
              {text("Caricamento...", "Loading...")}
            </div>
          )}

          {/* ══ AUTH GATE ══ */}
          {!isLoading && !user && (
            authDone === 'confirm_email' ? (
              <div style={{ textAlign: 'center', padding: '32px 0 40px' }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>📬</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)', marginBottom: 10 }}>{text("CONTROLLA LA TUA EMAIL", "CHECK YOUR EMAIL")}</div>
                <p style={{ color: 'var(--bone)', lineHeight: 1.6, marginBottom: 24 }}>
                  {text("Link inviato a", "Link sent to")} <strong style={{ color: 'var(--orange)' }}>{regEmail}</strong>.<br />
                  {text("Dopo la conferma, accedi qui.", "After confirming, sign in here.")}
                </p>
                <button onClick={() => { setAuthDone(null); setAuthTab('accedi'); }} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  {text("Vai ad Accedi", "Go to sign-in")}
                </button>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--gray-400)', fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
                  {text("Accedi o crea un account — il tuo", "Sign in or create an account — your")} <strong style={{ color: 'var(--orange)' }}>@username</strong> {text("apparirà sullo spot.", "will appear on the spot.")}
                </p>

                <div style={{ display: 'flex', marginBottom: 20, borderBottom: '1px solid var(--gray-700)' }}>
                  {(['accedi', 'registrati'] as AuthTab[]).map(t => (
                    <button key={t} onClick={() => { setAuthTab(t); setAuthError(null); }} style={{
                      flex: 1, fontFamily: 'var(--font-mono)', fontSize: 14, padding: '12px 0',
                      border: 'none', background: 'transparent',
                      color: authTab === t ? 'var(--orange)' : 'var(--gray-400)',
                      borderBottom: `2px solid ${authTab === t ? 'var(--orange)' : 'transparent'}`,
                      cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {t === 'accedi' ? text("Accedi", "Sign in") : text("Registrati", "Sign up")}
                    </button>
                  ))}
                </div>

                {authTab === 'accedi' && (
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div><label style={lbl}>Email</label><input type="email" style={inp} value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder={text("la-tua@email.com", "you@email.com")} onKeyDown={e => e.key === 'Enter' && handleSignIn()} /></div>
                    <div><label style={lbl}>Password</label><input type="password" style={inp} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSignIn()} /></div>
                    {authError && <ErrBox msg={authError} />}
                    {resetSent && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#00c851', background: 'rgba(0,200,81,0.08)', border: '1px solid rgba(0,200,81,0.2)', borderRadius: 6, padding: '10px 14px' }}>
                        {text("✅ Email inviata! Controlla la casella e clicca il link per reimpostare la password. Scade in 1 ora.", "✅ Email sent! Check your inbox and follow the password reset link. It expires in 1 hour.")}
                      </div>
                    )}
                    <button onClick={handleSignIn} disabled={authLoading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: authLoading ? 0.6 : 1 }}>
                      {authLoading ? text("⏳ Accesso...", "⏳ Signing in...") : text("Accedi", "Sign in")}
                    </button>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', margin: 0 }}>
                        {text("Non hai un account?", "No account yet?")}{' '}
                        <button onClick={() => { setAuthTab('registrati'); setAuthError(null); }}
                          style={{ background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 14 }}>
                          {text("Registrati →", "Sign up →")}
                        </button>
                      </p>
                      <button
                        disabled={resetLoading}
                        onClick={async () => {
                          if (!loginEmail) { setAuthError(text("Inserisci la tua email per reimpostare la password.", "Enter your email to reset your password.")); return; }
                          setResetLoading(true); setAuthError(null);
                          try { await resetPassword(loginEmail); setResetSent(true); }
                          catch (e: any) { setAuthError(e.message); }
                          finally { setResetLoading(false); }
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 14, textDecoration: 'underline', opacity: resetLoading ? 0.5 : 1 }}>
                        {resetLoading ? '⏳...' : text("Password dimenticata?", "Forgot password?")}
                      </button>
                    </div>
                  </div>
                )}

                {authTab === 'registrati' && (
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div>
                      <label style={lbl}>Username *</label>
                      <div style={{ position: 'relative' }}>
                        <input type="text"
                          style={{ ...inp, paddingLeft: 28, borderColor: usernameOk === false ? '#ff4444' : usernameOk === true ? '#00c851' : 'var(--gray-600)' }}
                          value={regUsername} onChange={e => onUsernameChange(e.target.value)}
                          placeholder={text("es. chrispy_bmx", "e.g. chrispy_bmx")} maxLength={30} />
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontFamily: 'var(--font-mono)', fontSize: 14 }}>@</span>
                        {checkingUn && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: 14 }}>...</span>}
                        {!checkingUn && usernameOk === true  && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#00c851' }}>✓</span>}
                        {!checkingUn && usernameOk === false && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#ff4444' }}>✗</span>}
                      </div>
                      {usernameOk === false && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#ff4444', marginTop: 2 }}>{text("Username già in uso", "Username already taken")}</div>}
                    </div>
                    <div><label style={lbl}>Email *</label><input type="email" style={inp} value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder={text("la-tua@email.com", "you@email.com")} /></div>
                    <div><label style={lbl}>{text("Password * (min 6 caratteri)", "Password * (at least 6 characters)")}</label><input type="password" style={inp} value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSignUp()} /></div>
                    <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gray-700)', borderRadius: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={ageConfirmed2} onChange={e => setAgeConfirmed2(e.target.checked)}
                          style={{ marginTop: 1, accentColor: 'var(--orange)', width: 18, height: 18, flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)', lineHeight: 1.5 }}>
                          {text("Confermo di avere almeno 14 anni", "I confirm that I am at least 14 years old")} <span style={{ color: 'var(--orange)' }}>*</span>
                        </span>
                      </label>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gray-700)', borderRadius: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={newsletterOptIn2} onChange={e => setNewsletterOptIn2(e.target.checked)}
                          style={{ marginTop: 1, accentColor: 'var(--orange)', width: 18, height: 18, flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)', lineHeight: 1.5 }}>
                          {NEWSLETTER_CONSENT_TEXT} <span style={{ fontSize: 14, color: 'var(--gray-400)' }}>{text("(facoltativo, disiscrizione con un click)", "(optional, unsubscribe with one click)")}</span>
                        </span>
                      </label>
                    </div>
                    {authError && <ErrBox msg={authError} />}
                    <button onClick={handleSignUp} disabled={authLoading || usernameOk === false} className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center', opacity: (authLoading || usernameOk === false) ? 0.6 : 1 }}>
                      {authLoading ? text("⏳ Registrazione...", "⏳ Creating account...") : text("Crea account", "Create account")}
                    </button>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-500)', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
                      {text("Registrandoti accetti la", "By signing up, you accept the")} <a href="/privacy" style={{ color: 'var(--orange)', textDecoration: 'underline' }}>Privacy Policy</a>.
                    </p>
                  </div>
                )}
              </div>
            )
          )}

          {/* ══ STEP 1 — POSIZIONE ══ */}
          {!isLoading && user && step === 'posizione' && (
            <div style={{ display: 'grid', gap: 16 }}>

              {/* Badge utente */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.2)', borderRadius: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 14, color: '#000', flexShrink: 0 }}>
                  {user.username[0].toUpperCase()}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)' }}>@{user.username}</span>
              </div>

              {/* ── GPS path ── */}
              {locMode === 'gps' && !hasCoords && (
                <div style={{ display: 'grid', gap: 12 }}>
                  {gpsState === 'idle' && (
                    /* Permesso già concesso → la posizione parte da sola (effetto sopra)
                       e qui non si vede nulla. Se manca, spieghiamo prima di far
                       comparire il dialog: chi se lo trova addosso senza contesto
                       tocca "Blocca", e il browser se lo ricorda per sempre. */
                    geoPreGranted === true ? null : (
                      <>
                        <div style={{
                          background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.25)',
                          borderRadius: 8, padding: '16px 14px', textAlign: 'center',
                        }}>
                          <div style={{ fontSize: 32, marginBottom: 8 }}>📍</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)', marginBottom: 6 }}>
                            {text("Prendiamo la posizione dello spot dal tuo telefono", "Use your phone to locate the spot")}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', lineHeight: 1.6 }}>
                            {text("Tocca", "Tap")} <strong style={{ color: 'var(--orange)' }}>{text("\"Consenti\"", "\"Allow\"")}</strong> {text("quando appare il dialog — serve solo per piazzare il pin, non ti tracciamo.", "when prompted — this only places the spot pin. We do not track you.")}
                          </div>
                        </div>
                        <button onClick={() => getGPS()} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                          {text("Usa la mia posizione", "Use my location")}
                        </button>
                      </>
                    )
                  )}
                  {gpsState === 'loading' && (
                    <div style={{ textAlign: 'center', padding: '24px 0', fontFamily: 'var(--font-mono)', color: 'var(--orange)', fontSize: 14 }}>
                      {text("⏳ Rilevamento GPS in corso...", "⏳ Finding your location...")}
                    </div>
                  )}
                  {gpsState === 'denied' && (
                    <>
                      <div style={{
                        background: 'rgba(255,80,50,0.08)', border: '1px solid rgba(255,80,50,0.25)',
                        borderRadius: 8, padding: '12px 14px',
                        fontFamily: 'var(--font-mono)', fontSize: 14, color: '#ff6b6b', lineHeight: 1.7,
                      }}>
                        <div style={{ marginBottom: 6 }}>{text("⚠ Permesso posizione bloccato.", "⚠ Location permission is blocked.")}</div>
                        <div style={{ color: 'var(--gray-300)', fontSize: 14 }}>
                          <strong style={{ color: 'var(--bone)' }}>📱 iPhone/Safari:</strong><br />
                          {text("Impostazioni → Privacy → Servizi di localizzazione → Safari →", "Settings → Privacy → Location Services → Safari →")} <em>{text("Mentre si usa l'app", "While Using the App")}</em>
                        </div>
                        <div style={{ color: 'var(--gray-300)', fontSize: 14, marginTop: 6 }}>
                          <strong style={{ color: 'var(--bone)' }}>🤖 Android/Chrome:</strong><br />
                          {text("Tocca il lucchetto nella barra URL → Autorizzazioni → Posizione → Consenti", "Tap the site controls in the address bar → Permissions → Location → Allow")}
                        </div>
                      </div>
                      <button onClick={() => { setGpsState('idle'); getGPS(); }} className="btn-secondary" style={{ justifyContent: 'center' }}>
                        {text("🔄 Riprova GPS", "🔄 Retry GPS")}
                      </button>
                      <button onClick={() => { setLocMode('coords'); setGpsState('idle'); }} className="btn-secondary" style={{ justifyContent: 'center' }}>
                        {text("🗺️ Inserisci posizione manualmente", "🗺️ Enter location manually")}
                      </button>
                    </>
                  )}
                  {gpsState === 'timeout' && (
                    <>
                      <ErrBox msg={text("GPS troppo lento. Spostati all'aperto o in un posto con segnale migliore e riprova.", "GPS is taking too long. Move outdoors or somewhere with a better signal and try again.")} />
                      <button onClick={() => { getGPS(); }} className="btn-secondary" style={{ justifyContent: 'center' }}>
                        {text("🔄 Riprova GPS", "🔄 Retry GPS")}
                      </button>
                      <button onClick={() => { setLocMode('coords'); setGpsState('idle'); }} className="btn-secondary" style={{ justifyContent: 'center' }}>
                        {text("🗺️ Inserisci posizione manualmente", "🗺️ Enter location manually")}
                      </button>
                    </>
                  )}
                  {gpsState === 'error' && (
                    <>
                      <ErrBox msg={text("GPS non disponibile su questo dispositivo. Usa il link Google Maps.", "GPS is unavailable on this device. Use a Google Maps link.")} />
                      <button onClick={() => { setLocMode('coords'); setGpsState('idle'); }} className="btn-secondary" style={{ justifyContent: 'center' }}>
                        {text("🗺️ Inserisci posizione manualmente", "🗺️ Enter location manually")}
                      </button>
                    </>
                  )}
                  {/* Via di fuga per chi NON è sullo spot — piccola, sotto tutto. */}
                  <button onClick={() => { setLocMode('coords'); setGpsState('idle'); }} style={backLink}>
                    {text("Non sono nello spot — inserisci le coordinate →", "I am not at the spot — enter coordinates →")}
                  </button>
                </div>
              )}

              {/* ── Coordinate / Google Maps ── */}
              {locMode === 'coords' && !hasCoords && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label style={lbl}>{text("Link Google Maps o coordinate", "Google Maps link or coordinates")}</label>
                    <textarea
                      style={{ ...inp, resize: 'none', fontSize: 14, lineHeight: 1.5 }}
                      rows={3}
                      value={coordInput}
                      onChange={e => { setCoordInput(e.target.value); setCoordError(null); }}
                      placeholder={text("https://maps.google.com/?q=...\noppure\n45.4384, 10.9916\noppure\n45°26'18.2\"N 10°59'29.8\"E", "https://maps.google.com/?q=...\nor\n45.4384, 10.9916\nor\n45°26'18.2\"N 10°59'29.8\"E")}
                      autoFocus
                    />
                    {coordError && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#ff6a00', marginTop: 4 }}>⚠ {coordError}</div>}
                  </div>
                  <button
                    onClick={handleConfirmCoords}
                    disabled={!coordInput.trim()}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', opacity: !coordInput.trim() ? 0.4 : 1 }}
                  >
                    {text("Conferma posizione", "Confirm location")}
                  </button>
                  <button onClick={() => { setLocMode('gps'); setCoordInput(''); setCoordError(null); }} style={backLink}>
                    {text("← Sono nello spot, usa il GPS", "← I am at the spot, use GPS")}
                  </button>
                </div>
              )}

              {/* Posizione confermata → check duplicati → avanti */}
              {hasCoords && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ background: 'var(--gray-700)', border: '1px solid rgba(0,200,81,0.4)', borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#00c851', marginBottom: 2 }}>{text("✅ Posizione confermata", "✅ Location confirmed")}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)' }}>{lat!.toFixed(5)}, {lon!.toFixed(5)}</div>
                    </div>
                    <button
                      onClick={() => { setLat(null); setLon(null); setCoordInput(''); setCoordError(null); setGpsState('idle'); setLocMode('gps'); }}
                      style={{ background: 'none', border: 'none', color: 'var(--orange)', fontFamily: 'var(--font-mono)', fontSize: 14, cursor: 'pointer' }}
                    >
                      {text("Rileva di nuovo →", "Locate again →")}
                    </button>
                  </div>

                  {/* Via di fuga, anche a posizione già presa.
                     Prendendo il GPS da soli si salta la schermata dove stava
                     questo link, quindi chi NON è sullo spot restava senza uscita. */}
                  <button
                    onClick={() => {
                      setLat(null); setLon(null);
                      setCoordInput(''); setCoordError(null);
                      setGpsState('idle'); setLocMode('coords');
                    }}
                    style={backLink}
                  >
                    {text("Non sono nello spot — ho le coordinate →", "I am not at the spot — I have coordinates →")}
                  </button>

                  {/* ── NEARBY SPOTS — duplicate detection ── */}
                  {nearbyLoading && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', textAlign: 'center', padding: '8px 0' }}>
                      {text("Controllo spot vicini...", "Checking nearby spots...")}
                    </div>
                  )}

                  {!nearbyLoading && nearbySpots.length > 0 && !nearbyDismissed && (
                    <div style={{
                      background: 'rgba(255,106,0,0.06)',
                      border: '1px solid rgba(255,106,0,0.3)',
                      borderRadius: 8, overflow: 'hidden',
                    }}>
                      <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,106,0,0.15)' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--orange)', marginBottom: 4 }}>
                          {text(`⚠️ Spot vicini trovati (${nearbySpots.length})`, `⚠️ Nearby spots found (${nearbySpots.length})`)}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', lineHeight: 1.5 }}>
                          {text("Ci sono già spot entro 150m. Il tuo è uno di questi o un ostacolo diverso?", "There are already spots within 150 m. Is yours one of these, or a different obstacle?")}
                        </div>
                      </div>

                      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                        {nearbySpots.map(ns => {
                          const tipo = TIPI_SPOT[ns.type];
                          const cover = ns.spot_photos?.sort((a, b) => a.position - b.position)?.[0]?.url;
                          return (
                            <div key={ns.id} style={{
                              display: 'flex', gap: 10, padding: '10px 14px',
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              alignItems: 'center',
                            }}>
                              {/* Thumbnail */}
                              <div style={{
                                width: 48, height: 48, borderRadius: 6, overflow: 'hidden',
                                background: 'var(--gray-800)', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {cover
                                  ? <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : <span style={{ fontSize: 20 }}>{tipo.emoji}</span>
                                }
                              </div>
                              {/* Info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {ns.name}
                                </div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)' }}>
                                  {tipo.emoji} {tipo.label} · {ns.distance}m · {ns.city ?? ''}
                                </div>
                              </div>
                              {/* "È questo" → redirect to spot page */}
                              <a
                                href={`/map/spot/${ns.slug}`}
                                onClick={e => e.stopPropagation()}
                                style={{
                                  fontFamily: 'var(--font-mono)', fontSize: 14,
                                  color: 'var(--orange)', textDecoration: 'none',
                                  border: '1px solid rgba(255,106,0,0.4)',
                                  borderRadius: 4, padding: '4px 8px',
                                  whiteSpace: 'nowrap', flexShrink: 0,
                                }}
                              >
                                {text("È QUESTO →", "THIS IS IT →")}
                              </a>
                            </div>
                          );
                        })}
                      </div>

                      {/* Actions */}
                      <div style={{ padding: '10px 14px', display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => setNearbyDismissed(true)}
                          className="btn-primary"
                          style={{ flex: 1, justifyContent: 'center', fontSize: 14, padding: '10px' }}
                        >
                          {text("🆕 È UN ALTRO SPOT — CONTINUA", "🆕 IT IS A DIFFERENT SPOT — CONTINUE")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Avanti button — shown when no nearby or dismissed */}
                  {(nearbySpots.length === 0 || nearbyDismissed) && !nearbyLoading && (
                    <button onClick={() => setStep('foto')} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                      {text("Avanti — Foto →", "Next — Photos →")}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══ STEP 2 — FOTO ══ */}
          {!isLoading && user && step === 'foto' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <p style={{ color: 'var(--gray-400)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                {text("Carica almeno una foto dello spot. La prima sarà la cover.", "Upload at least one photo of the spot. The first becomes its cover.")}
                {photos.length === 0 && (
                  <span style={{ display: 'block', marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--orange)' }}>
                    {text("* Almeno una foto è obbligatoria", "* At least one photo is required")}
                  </span>
                )}
              </p>
              <PhotoUpload photos={photos} onChange={handlePhotosChange} />
              {uploadError && <div role="status"><ErrBox msg={uploadError} /><button type="button" className="btn-secondary" onClick={() => handlePhotosChange(photos)}>{text("Riprova caricamento foto", "Retry photo upload")}</button></div>}
              {preUploadedUrls.length > 0 && !uploading && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#00c851', textAlign: 'center' }}>
                  {text(`✓ ${preUploadedUrls.length} foto pronte`, `✓ ${preUploadedUrls.length} photos ready`)}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep('posizione')} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>{text("← Indietro", "← Back")}</button>
                <button
                  onClick={() => setStep('dettagli')}
                  disabled={photos.length === 0}
                  className="btn-primary"
                  style={{ flex: 2, justifyContent: 'center', opacity: photos.length === 0 ? 0.4 : 1 }}
                >
                  {text("Avanti — Dettagli →", "Next — Details →")}
                </button>
              </div>
            </div>
          )}

          {/* ══ STEP 3 — DETTAGLI ══ */}
          {!isLoading && user && step === 'dettagli' && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <label style={lbl}>{text("Nome spot *", "Spot name *")}</label>
                <input type="text" style={inp} value={name} onChange={e => setName(e.target.value)}
                  placeholder={text("es. \"Gradoni Piazza Bra\"", "e.g. \"Piazza Bra steps\"")} maxLength={100} />
              </div>
              <div>
                <label style={lbl}>{text("Tipo *", "Type *")}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {TIPI_SPOT_SELEZIONABILI.map(([t, info]) => (
                    <button key={t} onClick={() => setType(t)} style={{
                      padding: '6px 12px',
                      border: `1px solid ${type === t ? info.color : 'var(--gray-600)'}`,
                      borderRadius: 2,
                      background: type === t ? info.color : 'transparent',
                      color: type === t ? 'var(--black)' : 'var(--bone)',
                      fontFamily: 'var(--font-mono)', fontSize: 14, cursor: 'pointer', transition: 'all 0.1s',
                    }}>
                      {info.emoji} {info.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={lbl}>{text("Cosa c'è (opzionale)", "Obstacles (optional)")}</label>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-500)', marginTop: 2 }}>
                  {text("Scegline quanti vuoi. Serve a chi cerca un rail o un bank.", "Select all that apply. This helps riders looking for a rail or a bank.")}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {(Object.entries(OSTACOLI) as [Ostacolo, typeof OSTACOLI[Ostacolo]][]).map(([o, info]) => {
                    const scelto = ostacoli.includes(o);
                    return (
                      <button
                        key={o}
                        onClick={() => setOstacoli(prev =>
                          prev.includes(o) ? prev.filter(x => x !== o) : prev.length >= 8 ? prev : [...prev, o]
                        )}
                        style={{
                          padding: '6px 11px',
                          border: `1px solid ${scelto ? 'var(--orange)' : 'var(--gray-600)'}`,
                          borderRadius: 2,
                          background: scelto ? 'var(--orange)' : 'transparent',
                          color: scelto ? 'var(--black)' : 'var(--bone)',
                          fontFamily: 'var(--font-mono)', fontSize: 14, cursor: 'pointer', transition: 'all 0.1s',
                        }}
                      >
                        {info.emoji} {text(info.label, o === 'stairs' ? 'Stairs' : o === 'curb' ? 'Curb' : info.label)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={lbl}>{text("Descrizione (opzionale)", "Description (optional)")}</label>
                <textarea style={{ ...inp, resize: 'vertical' }} rows={2}
                  value={description} onChange={e => setDescription(e.target.value)}
                  placeholder={text("Es. \"Gradoni in marmo, fondo buono. Presente anche un ledge.\"", "e.g. \"Marble steps, good ground. There is also a ledge.\"")}
                  maxLength={500} />
              </div>
              <div>
                <label style={lbl}>{text("Note accesso (opzionale)", "Access notes (optional)")}</label>
                <input type="text" style={inp} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder={text("Es. \"Security alle 18\" / \"Sempre libero\"", "e.g. \"Security after 6 pm\" / \"Always open\"")} maxLength={200} />
              </div>

              <div>
                <label style={lbl}>{text("Livello difficoltà (opzionale)", "Difficulty (optional)")}</label>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {DIFFICOLTA.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setDifficulty(difficulty === d.value ? '' : d.value)}
                      style={{
                        flex: 1, padding: '8px 4px',
                        border: `1px solid ${difficulty === d.value ? 'var(--orange)' : 'var(--gray-600)'}`,
                        borderRadius: 2,
                        background: difficulty === d.value ? 'rgba(255,106,0,0.15)' : 'transparent',
                        color: difficulty === d.value ? 'var(--orange)' : 'var(--bone)',
                        fontFamily: 'var(--font-mono)', fontSize: 14, cursor: 'pointer',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {uploadError && <div role="status"><ErrBox msg={uploadError} /><button type="button" className="btn-secondary" disabled={submitting} onClick={() => handlePhotosChange(photos)}>{text("Riprova caricamento foto", "Retry photo upload")}</button></div>}
              {error && <ErrBox msg={error} />}

              <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gray-700)', borderRadius: 6 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', lineHeight: 1.6, margin: 0 }}>
                  {text("Inviando, il tuo @username, le foto e le coordinate GPS saranno visibili sulla mappa dopo approvazione. La tua email resta privata. Le foto non devono contenere volti o targhe.", "After approval, your @username, photos and GPS coordinates will appear on the map. Your email stays private. Photos must not contain faces or licence plates.")}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setStep('foto'); setError(null); }} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>{text("← Indietro", "← Back")}</button>
                <button
                  onClick={handleSubmit}
                  disabled={!name.trim() || !type || submitting}
                  className="btn-primary"
                  style={{ flex: 2, justifyContent: 'center', opacity: (!name.trim() || !type || submitting) ? 0.5 : 1 }}
                >
                  {submitting ? text("⏳ Invio...", "⏳ Sending...") : text("Invia spot", "Submit spot")}
                </button>
              </div>
            </div>
          )}

          {/* ══ SUCCESSO ══ */}
          {step === 'successo' && (
            <div style={{ textAlign: 'center', padding: '20px 0 30px' }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>🏴</div>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 24, color: 'var(--orange)', marginBottom: 10 }}>{text("SPOT INVIATO!", "SPOT SUBMITTED!")}</h3>
              <p style={{ color: 'var(--bone)', lineHeight: 1.6, marginBottom: 12 }}>
                {text("Grazie", "Thanks")} <strong style={{ color: 'var(--orange)' }}>@{user?.username}</strong>!
              </p>
              <div style={{ background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.25)', borderRadius: 8, padding: '14px 16px', marginBottom: 24, textAlign: 'left' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--orange)', marginBottom: 6 }}>{text("⏳ IN REVISIONE", "⏳ AWAITING REVIEW")}</div>
                <p style={{ color: 'var(--bone)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                  {text("Lo spot apparirà sulla mappa entro 24-48 ore, dopo la mia revisione manuale.", "The spot will appear on the map within 24–48 hours, after my manual review.")}
                </p>
              </div>
              <button onClick={handleClose} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                {text("Torna alla mappa", "Back to the map")}
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}


const backLink: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--gray-400)',
  fontFamily: 'var(--font-mono)', fontSize: 14, cursor: 'pointer',
  padding: '4px 0', textAlign: 'left' as const,
};

function ErrBox({ msg }: { msg: string }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#ff4444', background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.2)', borderRadius: 4, padding: '10px 12px' }}>
      ⚠ {msg}
    </div>
  );
}
