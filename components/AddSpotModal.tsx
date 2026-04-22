'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TIPI_SPOT, CITTA_ITALIANE } from '@/lib/constants';
import type { SpotType } from '@/lib/types';
import PhotoUpload from './PhotoUpload';
import { useUser } from '@/hooks/useUser';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { signIn, signUp, checkUsername, signInWithGoogle } from '@/lib/auth-client';

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

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
  borderRadius: 4, color: 'var(--bone)', fontFamily: 'var(--font-mono)',
  fontSize: 15, padding: '10px 12px', outline: 'none',
};
const lbl: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)',
  textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6,
};

/* ── Estrai coordinate da URL Google Maps ── */
function parseGoogleMapsUrl(url: string): { lat: number; lon: number } | null {
  const m1 = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (m1) return { lat: parseFloat(m1[1]), lon: parseFloat(m1[2]) };
  const m2 = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (m2) return { lat: parseFloat(m2[1]), lon: parseFloat(m2[2]) };
  const m3 = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (m3) return { lat: parseFloat(m3[1]), lon: parseFloat(m3[2]) };
  return null;
}

/* ── Mappa interattiva con pin draggabile (Leaflet) ── */
function LocationMapPicker({
  lat, lon, onPick,
}: {
  lat: number | null;
  lon: number | null;
  onPick: (lat: number, lon: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<import('leaflet').Map | null>(null);
  const markerRef    = useRef<import('leaflet').Marker | null>(null);
  const onPickRef    = useRef(onPick);
  useEffect(() => { onPickRef.current = onPick; });

  /* Init mappa */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;

      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const center: [number, number] = lat != null ? [lat, lon!] : [42.5, 12.5];
      const zoom = lat != null ? 15 : 6;

      const map = L.map(containerRef.current!, { center, zoom, zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, className: 'osm-tiles',
      }).addTo(map);
      mapRef.current = map;

      /* Marker iniziale se abbiamo già le coordinate */
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

      /* Click sulla mappa → posiziona/sposta pin */
      map.on('click', (e) => addMarker(e.latlng.lat, e.latlng.lng));
    });

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Fly-to quando arrivano coordinate esterne (es. ricerca indirizzo o paste URL) */
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
      <div ref={containerRef} style={{ width: '100%', height: 280 }} />
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(10,10,10,0.82)', borderRadius: 4, padding: '3px 10px',
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--orange)',
        pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        {lat != null ? `📍 ${lat.toFixed(5)}, ${lon!.toFixed(5)}` : 'Clicca sulla mappa per posizionare il pin'}
      </div>
    </div>
  );
}

/* ── Selettore città con ricerca testuale ── */
function RegionCityPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [search, setSearch] = useState('');
  const [open,   setOpen]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pool = CITTA_ITALIANE.filter(c => c.value !== 'altro');

  const filtered = search.trim().length >= 1
    ? pool.filter(c => c.label.toLowerCase().includes(search.toLowerCase())).slice(0, 30)
    : [];

  const selectedLabel = CITTA_ITALIANE.find(c => c.value === value)?.label ?? '';

  const pickCity = (v: string, label: string) => {
    onChange(v);
    setSearch(label);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        placeholder='Es. "Bologna", "Milano", "Trento"...'
        value={search || selectedLabel}
        onChange={e => { setSearch(e.target.value); setOpen(true); onChange(''); }}
        onFocus={() => { if (!value) setOpen(true); }}
        style={{ ...inp, paddingRight: value ? 30 : 12 }}
        autoComplete="off"
      />
      {value && (
        <button
          onClick={() => { onChange(''); setSearch(''); inputRef.current?.focus(); }}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer', fontSize: 14, padding: 0 }}>
          ✕
        </button>
      )}

      {/* Dropdown risultati */}
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '100%',
          background: 'var(--gray-700)', border: '1px solid var(--gray-500)',
          borderTop: 'none', borderRadius: '0 0 6px 6px',
          maxHeight: 180, overflowY: 'auto', zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {filtered.map(c => (
            <button
              key={c.value}
              onMouseDown={e => { e.preventDefault(); pickCity(c.value, c.label); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: 14,
                background: c.value === value ? 'rgba(255,106,0,0.12)' : 'none',
                border: 'none', borderBottom: '1px solid var(--gray-600)',
                color: c.value === value ? 'var(--orange)' : 'var(--bone)',
                cursor: 'pointer',
              }}
            >
              {c.label}
              {c.value === value && <span style={{ marginLeft: 8, color: 'var(--orange)', fontSize: 12 }}>✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* Chiudi dropdown cliccando fuori */}
      {open && filtered.length > 0 && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 99 }} aria-hidden />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
export default function AddSpotModal({ open, onClose, initialLat, initialLon }: AddSpotModalProps) {
  const user      = useUser();
  const isLoading = user === undefined;

  const [step, setStep] = useState<Step>('posizione');
  const [lat,  setLat]  = useState<number | null>(initialLat ?? null);
  const [lon,  setLon]  = useState<number | null>(initialLon ?? null);
  const [city, setCity] = useState('');
  const [locMode, setLocMode] = useState<'gps' | 'map' | null>(initialLat != null ? 'map' : null);

  /* GPS */
  const [gpsState, setGpsState] = useState<'idle' | 'loading' | 'ok' | 'error'>(
    initialLat != null ? 'ok' : 'idle'
  );

  /* Ricerca indirizzo (per centrare la mappa) */
  const [addrQuery,    setAddrQuery]    = useState('');
  const [addrLoading,  setAddrLoading]  = useState(false);
  const [addrError,    setAddrError]    = useState<string | null>(null);

  /* Incolla URL Google Maps */
  const [gmapsUrl,    setGmapsUrl]    = useState('');
  const [gmapsError,  setGmapsError]  = useState<string | null>(null);
  const [gmapsOpen,   setGmapsOpen]   = useState(false);

  /* Foto */
  const [photos, setPhotos] = useState<File[]>([]);

  /* Dettagli */
  const [name,        setName]        = useState('');
  const [type,        setType]        = useState<SpotType | ''>('');
  const [description, setDescription] = useState('');
  const [notes,       setNotes]       = useState('');

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

  /* Reverse geocode → auto-popola città */
  const reverseGeocode = useCallback(async (eLat: number, eLon: number) => {
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${eLat}&lon=${eLon}&format=json&addressdetails=1&accept-language=it`, { headers: { 'Accept-Language': 'it' } });
      const data = await res.json();
      const cn = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || '';
      if (cn) {
        const match = CITTA_ITALIANE.find(c =>
          c.label.toLowerCase().includes(cn.toLowerCase()) ||
          cn.toLowerCase().includes(c.label.toLowerCase())
        );
        if (match) setCity(match.value);
      }
    } catch { /* silent */ }
  }, []);

  /* Sync initialLat/Lon */
  useEffect(() => {
    if (initialLat != null && initialLon != null) {
      setLat(initialLat); setLon(initialLon);
      setLocMode('map'); setGpsState('ok');
      reverseGeocode(initialLat, initialLon);
    }
  }, [initialLat, initialLon, reverseGeocode]);

  /* Reset */
  const handleClose = useCallback(() => {
    setStep('posizione');
    setLat(initialLat ?? null); setLon(initialLon ?? null); setCity('');
    setLocMode(initialLat != null ? 'map' : null);
    setGpsState(initialLat != null ? 'ok' : 'idle');
    setAddrQuery(''); setAddrError(null);
    setGmapsUrl(''); setGmapsError(null); setGmapsOpen(false);
    setPhotos([]);
    setName(''); setType(''); setDescription(''); setNotes('');
    setError(null); setSubmitting(false);
    setAuthError(null); setAuthDone(null);
    setRegUsername(''); setRegEmail(''); setRegPassword('');
    setLoginEmail(''); setLoginPassword('');
    onClose();
  }, [initialLat, initialLon, onClose]);

  /* GPS */
  const getGPS = () => {
    if (!navigator.geolocation) { setGpsState('error'); return; }
    setGpsState('loading');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude); setLon(longitude); setGpsState('ok');
        reverseGeocode(latitude, longitude);
      },
      () => setGpsState('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  /* Ricerca indirizzo → centra mappa */
  const handleAddrSearch = async () => {
    if (!addrQuery.trim()) return;
    setAddrLoading(true); setAddrError(null);
    try {
      const q = `${addrQuery.trim()}, Italia`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1&accept-language=it`, { headers: { 'Accept-Language': 'it' } });
      const data = await res.json();
      if (!data.length) { setAddrError('Indirizzo non trovato.'); return; }
      const r = data[0];
      setLat(parseFloat(r.lat));
      setLon(parseFloat(r.lon));
      // Auto-città
      const cn = r.address?.city || r.address?.town || r.address?.village || '';
      if (cn) {
        const match = CITTA_ITALIANE.find(c =>
          c.label.toLowerCase().includes(cn.toLowerCase()) ||
          cn.toLowerCase().includes(c.label.toLowerCase())
        );
        if (match) setCity(match.value);
      }
    } catch { setAddrError('Errore di rete.'); }
    finally { setAddrLoading(false); }
  };

  /* Paste URL Google Maps */
  const handleGmapsPaste = () => {
    const parsed = parseGoogleMapsUrl(gmapsUrl);
    if (!parsed) {
      setGmapsError('URL non riconosciuto. Copia il link direttamente da Google Maps.');
      return;
    }
    setLat(parsed.lat); setLon(parsed.lon);
    setGmapsUrl(''); setGmapsError(null); setGmapsOpen(false);
    reverseGeocode(parsed.lat, parsed.lon);
  };

  /* Submit */
  const handleSubmit = async () => {
    if (!user || !name.trim() || !type || lat == null) return;
    setSubmitting(true); setError(null);
    try {
      const { data: { session } } = await supabaseBrowser().auth.getSession();
      if (!session?.access_token) {
        setError('Sessione scaduta. Chiudi il modal, ricarica la pagina e riprova.');
        return;
      }
      const fd = new FormData();
      fd.append('data', JSON.stringify({
        name: name.trim(), type, lat, lon: lon!,
        city: city || undefined,
        description: description || undefined,
        guardians: notes || undefined,
        access_token: session.access_token,
      }));
      photos.forEach((p, i) => fd.append(`photo_${i}`, p));
      const res  = await fetch('/api/submit-spot', { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Errore durante l\'invio.');
      setStep('successo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto. Riprova.');
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
    }, 600);
  };

  const handleSignUp = async () => {
    if (!regUsername || !regEmail || !regPassword) { setAuthError('Compila tutti i campi.'); return; }
    if (regUsername.length < 3) { setAuthError('Username min 3 caratteri.'); return; }
    if (regPassword.length < 6) { setAuthError('Password min 6 caratteri.'); return; }
    setAuthLoading(true); setAuthError(null);
    try { const result = await signUp(regEmail, regPassword, regUsername); setAuthDone(result); }
    catch (e) { setAuthError(e instanceof Error ? e.message : 'Errore sconosciuto'); }
    finally { setAuthLoading(false); }
  };

  const handleSignIn = async () => {
    if (!loginEmail || !loginPassword) { setAuthError('Inserisci email e password.'); return; }
    setAuthLoading(true); setAuthError(null);
    try { await signIn(loginEmail, loginPassword); }
    catch (e) { setAuthError(e instanceof Error ? e.message : 'Errore sconosciuto'); }
    finally { setAuthLoading(false); }
  };

  if (!open) return null;

  const hasCoords  = lat != null && lon != null;
  const stepIndex  = STEPS.indexOf(step as Step);
  const progressPct = step === 'successo' ? 100 : (stepIndex / (STEPS.length - 1)) * 100;

  return (
    <>
      <div onClick={handleClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 69, backdropFilter: 'blur(4px)' }}
        aria-hidden />

      <div role="dialog" aria-modal aria-label="Aggiungi spot BMX" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--gray-800)', borderTop: '2px solid var(--orange)',
        borderRadius: '16px 16px 0 0', zIndex: 70,
        maxHeight: '92dvh', overflowY: 'auto', overscrollBehavior: 'contain',
        animation: 'slideUp 0.3s ease-out',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
      }}>
        <div className="bottom-sheet-handle" />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 14px', borderBottom: '1px solid var(--gray-700)' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--orange)', margin: 0 }}>🏴 AGGIUNGI SPOT</h2>
            {user && step !== 'successo' && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
                {STEP_LABEL[step]}
              </div>
            )}
          </div>
          <button onClick={handleClose} className="btn-ghost" aria-label="Chiudi" style={{ fontSize: 20 }}>✕</button>
        </div>

        {/* Progress */}
        {user && step !== 'successo' && (
          <div style={{ height: 3, background: 'var(--gray-700)' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--orange)', transition: 'width 0.3s ease-out' }} />
          </div>
        )}

        <div style={{ padding: '20px' }}>

          {/* Loading */}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: 'var(--font-mono)', color: 'var(--gray-400)' }}>
              Caricamento...
            </div>
          )}

          {/* ══ AUTH GATE ══ */}
          {!isLoading && !user && (
            authDone === 'confirm_email' ? (
              <div style={{ textAlign: 'center', padding: '32px 0 40px' }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>📬</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)', marginBottom: 10 }}>CONTROLLA LA TUA EMAIL</div>
                <p style={{ color: 'var(--bone)', lineHeight: 1.6, marginBottom: 24 }}>
                  Link inviato a <strong style={{ color: 'var(--orange)' }}>{regEmail}</strong>.<br />
                  Dopo la conferma, accedi qui.
                </p>
                <button onClick={() => { setAuthDone(null); setAuthTab('accedi'); }} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  🔑 Vai ad Accedi
                </button>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--gray-400)', fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
                  Accedi o crea un account — il tuo <strong style={{ color: 'var(--orange)' }}>@username</strong> apparirà sullo spot.
                </p>

                <div style={{ marginBottom: 16 }}>
                  <GoogleSignInBtn onClick={async () => {
                    setAuthLoading(true); setAuthError(null);
                    try { await signInWithGoogle(); }
                    catch (e) { setAuthError(e instanceof Error ? e.message : 'Errore'); setAuthLoading(false); }
                  }} disabled={authLoading} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--gray-700)' }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>oppure</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--gray-700)' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', marginBottom: 20, borderBottom: '1px solid var(--gray-700)' }}>
                  {(['accedi', 'registrati'] as AuthTab[]).map(t => (
                    <button key={t} onClick={() => { setAuthTab(t); setAuthError(null); }} style={{
                      flex: 1, fontFamily: 'var(--font-mono)', fontSize: 14, padding: '12px 0',
                      border: 'none', background: 'transparent',
                      color: authTab === t ? 'var(--orange)' : 'var(--gray-400)',
                      borderBottom: `2px solid ${authTab === t ? 'var(--orange)' : 'transparent'}`,
                      cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {t === 'accedi' ? '🔑 Accedi' : '🏴 Registrati'}
                    </button>
                  ))}
                </div>

                {authTab === 'accedi' && (
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div><label style={lbl}>Email</label><input type="email" style={inp} value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="la-tua@email.com" onKeyDown={e => e.key === 'Enter' && handleSignIn()} /></div>
                    <div><label style={lbl}>Password</label><input type="password" style={inp} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSignIn()} /></div>
                    {authError && <ErrBox msg={authError} />}
                    <button onClick={handleSignIn} disabled={authLoading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: authLoading ? 0.6 : 1 }}>
                      {authLoading ? '⏳ Accesso...' : '🔑 ENTRA'}
                    </button>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)', textAlign: 'center' }}>
                      Non hai un account?{' '}
                      <button onClick={() => { setAuthTab('registrati'); setAuthError(null); }}
                        style={{ background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                        Registrati →
                      </button>
                    </p>
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
                          placeholder="es. chrispy_bmx" maxLength={30} />
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontFamily: 'var(--font-mono)', fontSize: 14 }}>@</span>
                        {checkingUn && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: 12 }}>...</span>}
                        {!checkingUn && usernameOk === true  && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#00c851' }}>✓</span>}
                        {!checkingUn && usernameOk === false && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#ff4444' }}>✗</span>}
                      </div>
                      {usernameOk === false && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff4444', marginTop: 2 }}>Username già in uso</div>}
                    </div>
                    <div><label style={lbl}>Email *</label><input type="email" style={inp} value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="la-tua@email.com" /></div>
                    <div><label style={lbl}>Password * (min 6 caratteri)</label><input type="password" style={inp} value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSignUp()} /></div>
                    {authError && <ErrBox msg={authError} />}
                    <button onClick={handleSignUp} disabled={authLoading || usernameOk === false} className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center', opacity: (authLoading || usernameOk === false) ? 0.6 : 1 }}>
                      {authLoading ? '⏳ Registrazione...' : '🏴 CREA ACCOUNT'}
                    </button>
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
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)' }}>@{user.username}</span>
              </div>

              {/* ── Scelta metodo (prima schermata) ── */}
              {!locMode && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Come vuoi indicare la posizione?
                  </p>
                  <button onClick={() => { setLocMode('gps'); getGPS(); }} style={methodBtn}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--orange)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--gray-600)')}>
                    <span style={{ fontSize: 28 }}>📍</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--bone)', marginBottom: 2 }}>Sono nello spot</div>
                      <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>Usa il GPS del telefono</div>
                    </div>
                  </button>
                  <button onClick={() => setLocMode('map')} style={methodBtn}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--orange)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--gray-600)')}>
                    <span style={{ fontSize: 28 }}>🗺️</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--bone)', marginBottom: 2 }}>Cerca sulla mappa</div>
                      <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>Cerca l'indirizzo o clicca sulla mappa</div>
                    </div>
                  </button>
                </div>
              )}

              {/* ── GPS path ── */}
              {locMode === 'gps' && (
                <div style={{ display: 'grid', gap: 12 }}>
                  {gpsState === 'loading' && (
                    <div style={{ textAlign: 'center', padding: '20px 0', fontFamily: 'var(--font-mono)', color: 'var(--orange)', fontSize: 14 }}>
                      ⏳ Rilevamento GPS in corso...
                    </div>
                  )}
                  {gpsState === 'ok' && hasCoords && (
                    <div style={{ background: 'var(--gray-700)', border: '1px solid rgba(0,200,81,0.4)', borderRadius: 6, padding: '12px 14px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#00c851', marginBottom: 4 }}>✅ Posizione rilevata</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)' }}>{lat!.toFixed(6)}, {lon!.toFixed(6)}</div>
                    </div>
                  )}
                  {gpsState === 'error' && <ErrBox msg="GPS non disponibile. Usa la mappa." />}
                  {gpsState !== 'loading' && !hasCoords && gpsState !== 'error' && (
                    <button onClick={getGPS} className="btn-primary" style={{ justifyContent: 'center' }}>
                      📍 Usa la mia posizione GPS
                    </button>
                  )}
                  {gpsState === 'error' && (
                    <button onClick={() => { setLocMode('map'); setGpsState('idle'); }} className="btn-secondary" style={{ justifyContent: 'center' }}>
                      🗺️ Cerca sulla mappa
                    </button>
                  )}

                  {/* Città — sempre visibile nel GPS path */}
                  {hasCoords && (
                    <div>
                      <label style={lbl}>Città</label>
                      <RegionCityPicker value={city} onChange={setCity} />
                    </div>
                  )}

                  <button onClick={() => { setLocMode(null); setLat(null); setLon(null); setGpsState('idle'); }} style={backLink}>
                    ← Cambia metodo
                  </button>
                </div>
              )}

              {/* ── MAPPA interattiva ── */}
              {locMode === 'map' && (
                <div style={{ display: 'grid', gap: 12 }}>

                  {/* Ricerca indirizzo */}
                  <div>
                    <label style={lbl}>Cerca indirizzo (per centrare la mappa)</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text" style={{ ...inp, flex: 1 }}
                        value={addrQuery}
                        onChange={e => setAddrQuery(e.target.value)}
                        placeholder='Es. "Via Roma 12, Milano" o "Skatepark di Trento"'
                        onKeyDown={e => e.key === 'Enter' && handleAddrSearch()}
                      />
                      <button
                        onClick={handleAddrSearch}
                        disabled={addrLoading || !addrQuery.trim()}
                        className="btn-secondary"
                        style={{ padding: '10px 14px', fontSize: 14, flexShrink: 0, opacity: addrLoading ? 0.6 : 1 }}
                      >
                        {addrLoading ? '⏳' : '🔍'}
                      </button>
                    </div>
                    {addrError && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff6a00', marginTop: 4 }}>{addrError}</div>}
                  </div>

                  {/* Mappa Leaflet interattiva */}
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                      Clicca sulla mappa per posizionare il pin — poi trascinalo per essere preciso
                    </div>
                    <LocationMapPicker lat={lat} lon={lon} onPick={(eLat, eLon) => { setLat(eLat); setLon(eLon); }} />
                  </div>

                  {/* Incolla link Google Maps / Street View */}
                  <div>
                    <button
                      onClick={() => { setGmapsOpen(o => !o); setGmapsError(null); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'none', border: 'none',
                        fontFamily: 'var(--font-mono)', fontSize: 12,
                        color: gmapsOpen ? 'var(--orange)' : 'var(--gray-400)',
                        cursor: 'pointer', padding: 0,
                        textDecoration: 'underline', textUnderlineOffset: 3,
                      }}
                    >
                      🧍 Hai trovato la posizione in Street View? Incolla il link →
                    </button>

                    {gmapsOpen && (
                      <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)', lineHeight: 1.5 }}>
                          In Google Maps / Street View: tasto destro → &quot;Copia coordinate&quot; o copia l&apos;URL dalla barra del browser e incollalo qui.
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            type="text" style={{ ...inp, flex: 1, fontSize: 13 }}
                            value={gmapsUrl}
                            onChange={e => { setGmapsUrl(e.target.value); setGmapsError(null); }}
                            placeholder="https://maps.google.com/... o 45.4384, 10.9916"
                            onKeyDown={e => e.key === 'Enter' && handleGmapsPaste()}
                          />
                          <button
                            onClick={handleGmapsPaste}
                            disabled={!gmapsUrl.trim()}
                            className="btn-primary"
                            style={{ padding: '10px 14px', fontSize: 13, flexShrink: 0 }}
                          >
                            OK
                          </button>
                        </div>
                        {gmapsError && <ErrBox msg={gmapsError} />}
                      </div>
                    )}
                  </div>

                  {/* Selezione città */}
                  <div>
                    <label style={lbl}>Città</label>
                    <RegionCityPicker value={city} onChange={setCity} />
                  </div>

                  <button onClick={() => { setLocMode(null); setAddrQuery(''); setAddrError(null); setGmapsOpen(false); }} style={backLink}>
                    ← Cambia metodo
                  </button>
                </div>
              )}

              {/* Avanti */}
              {hasCoords && (
                <button onClick={() => setStep('foto')} className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}>
                  ✅ Posizione confermata — Avanti →
                </button>
              )}
            </div>
          )}

          {/* ══ STEP 2 — FOTO ══ */}
          {!isLoading && user && step === 'foto' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <p style={{ color: 'var(--gray-400)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                Carica fino a 5 foto dello spot. La prima sarà la cover.<br />
                <span style={{ fontSize: 13 }}>Puoi saltare se non hai foto.</span>
              </p>
              <PhotoUpload photos={photos} onChange={setPhotos} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep('posizione')} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>← Indietro</button>
                <button onClick={() => setStep('dettagli')} className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}>Avanti →</button>
              </div>
            </div>
          )}

          {/* ══ STEP 3 — DETTAGLI ══ */}
          {!isLoading && user && step === 'dettagli' && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <label style={lbl}>Nome spot *</label>
                <input type="text" style={inp} value={name} onChange={e => setName(e.target.value)}
                  placeholder='es. "Gradoni Piazza Bra"' maxLength={100} />
              </div>
              <div>
                <label style={lbl}>Tipo *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {(Object.entries(TIPI_SPOT) as [SpotType, typeof TIPI_SPOT[SpotType]][]).map(([t, info]) => (
                    <button key={t} onClick={() => setType(t)} style={{
                      padding: '6px 12px',
                      border: `1px solid ${type === t ? info.color : 'var(--gray-600)'}`,
                      borderRadius: 2,
                      background: type === t ? info.color : 'transparent',
                      color: type === t ? 'var(--black)' : 'var(--bone)',
                      fontFamily: 'var(--font-mono)', fontSize: 13, cursor: 'pointer', transition: 'all 0.1s',
                    }}>
                      {info.emoji} {info.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={lbl}>Descrizione (opzionale)</label>
                <textarea style={{ ...inp, resize: 'vertical' }} rows={2}
                  value={description} onChange={e => setDescription(e.target.value)}
                  placeholder='Es. "Gradoni in marmo, fondo buono. Presente anche un ledge."'
                  maxLength={500} />
              </div>
              <div>
                <label style={lbl}>Note accesso / guardiani (opzionale)</label>
                <input type="text" style={inp} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder='Es. "Security alle 18" / "Sempre libero"' maxLength={200} />
              </div>

              {error && <ErrBox msg={error} />}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setStep('foto'); setError(null); }} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>← Indietro</button>
                <button
                  onClick={handleSubmit}
                  disabled={!name.trim() || !type || submitting}
                  className="btn-primary"
                  style={{ flex: 2, justifyContent: 'center', opacity: (!name.trim() || !type || submitting) ? 0.5 : 1 }}
                >
                  {submitting ? '⏳ Invio...' : '🏴 INVIA SPOT'}
                </button>
              </div>
            </div>
          )}

          {/* ══ SUCCESSO ══ */}
          {step === 'successo' && (
            <div style={{ textAlign: 'center', padding: '20px 0 30px' }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>🏴</div>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 24, color: 'var(--orange)', marginBottom: 10 }}>SPOT INVIATO!</h3>
              <p style={{ color: 'var(--bone)', lineHeight: 1.6, marginBottom: 12 }}>
                Grazie <strong style={{ color: 'var(--orange)' }}>@{user?.username}</strong>!
              </p>
              <div style={{ background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.25)', borderRadius: 8, padding: '14px 16px', marginBottom: 24, textAlign: 'left' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orange)', marginBottom: 6 }}>⏳ IN REVISIONE</div>
                <p style={{ color: 'var(--bone)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                  Lo spot apparirà sulla mappa entro 24-48 ore, dopo la mia revisione manuale.
                </p>
              </div>
              <button onClick={handleClose} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Torna alla mappa
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

/* ─── Componenti condivisi ─── */
const methodBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14,
  width: '100%', padding: '16px', textAlign: 'left',
  background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
  borderRadius: 8, cursor: 'pointer', transition: 'border-color 0.15s',
};

const backLink: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--gray-400)',
  fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer',
  padding: '4px 0', textAlign: 'left' as const,
};

function ErrBox({ msg }: { msg: string }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#ff4444', background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.2)', borderRadius: 4, padding: '10px 12px' }}>
      ⚠ {msg}
    </div>
  );
}

function GoogleSignInBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: '12px 16px', background: '#fff', border: '1px solid #ddd', borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
        fontFamily: 'var(--font-mono)', fontSize: 14, color: '#333', fontWeight: 500,
        transition: 'box-shadow 0.15s',
      }}
      onMouseOver={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
      onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
    >
      <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      Continua con Google
    </button>
  );
}
