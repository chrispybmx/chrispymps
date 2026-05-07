'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import { JAM_ROMA, JAM_SPOTS, getJamState, type JamState } from '@/lib/jamroma';
import { useUser } from '@/hooks/useUser';

/* ═══════════════════════════════════════════════
   Poster palette
═══════════════════════════════════════════════ */
const C = {
  coral:  '#E85D75',
  violet: '#7B5EA7',
  yellow: '#F5A623',
  green:  '#2D8C5A',
  cream:  '#F2E8D5',
  dark:   '#1A1020',
  darkViolet: '#2D1F42',
} as const;

/* ═══════════════════════════════════════════════
   Types
═══════════════════════════════════════════════ */
interface Rsvp { id: string; display_name: string }
interface Rider { id: string; display_name: string; lat: number; lon: number }
interface Spot { id: string; slug: string; label: string; lat: number; lon: number; meetingPoint: boolean; description: string; coverUrl: string | null; type: string }

/* ═══════════════════════════════════════════════
   Main Component
═══════════════════════════════════════════════ */
export default function JamRomaClient() {
  const user = useUser();
  const [jamState, setJamState] = useState<JamState>(getJamState());
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [rsvpCount, setRsvpCount] = useState(0);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [rsvpDone, setRsvpDone] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [rsvpError, setRsvpError] = useState('');
  const [anonName, setAnonName] = useState('');
  const [sharing, setSharing] = useState(false);
  const [sharingError, setSharingError] = useState('');
  const [showConsentModal, setShowConsentModal] = useState(false);
  const presenceInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const iv = setInterval(() => setJamState(getJamState()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const fetchRsvps = useCallback(async () => {
    try {
      const r = await fetch('/api/events/jamroma/rsvp');
      const j = await r.json();
      if (j.ok) { setRsvps(j.rsvps); setRsvpCount(j.count); }
    } catch {}
  }, []);

  useEffect(() => {
    fetch('/api/events/jamroma/spots')
      .then(r => r.json())
      .then(j => { if (j.ok) setSpots(j.spots); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchRsvps();
    const iv = setInterval(fetchRsvps, 30_000);
    return () => clearInterval(iv);
  }, [fetchRsvps]);

  // Fetch rider presence
  const fetchRiders = useCallback(async () => {
    try {
      const r = await fetch('/api/events/jamroma/presence');
      const j = await r.json();
      if (j.ok) setRiders(j.riders);
    } catch {}
  }, []);

  useEffect(() => {
    if (jamState === 'after') return;
    fetchRiders();
    const iv = setInterval(fetchRiders, 15_000);
    return () => clearInterval(iv);
  }, [jamState, fetchRiders]);

  const handleRsvp = async () => {
    setRsvpLoading(true); setRsvpError('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user?.accessToken) headers['Authorization'] = `Bearer ${user.accessToken}`;
      const body = user ? {} : { display_name: anonName.trim() };
      const r = await fetch('/api/events/jamroma/rsvp', {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.ok) { setRsvpDone(true); fetchRsvps(); }
      else { setRsvpError(j.error ?? 'Errore, riprova.'); }
    } catch { setRsvpError('Errore di rete, riprova.'); }
    finally { setRsvpLoading(false); }
  };

  const handleCancelRsvp = async () => {
    if (!user?.accessToken) return;
    setRsvpLoading(true);
    try {
      const r = await fetch('/api/events/jamroma/rsvp', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      const j = await r.json();
      if (j.ok) { setRsvpDone(false); fetchRsvps(); }
    } catch {}
    finally { setRsvpLoading(false); }
  };

  // Step 1: mostra modal consenso
  const startSharing = () => {
    setShowConsentModal(true);
  };

  // Step 2: utente conferma → chiedi geolocation al browser
  const doStartSharing = () => {
    setShowConsentModal(false);
    if (!('geolocation' in navigator)) { setSharingError('Geolocalizzazione non supportata'); return; }
    setSharingError('');
    const sendPosition = (pos: GeolocationPosition) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user?.accessToken) headers['Authorization'] = `Bearer ${user.accessToken}`;
      fetch('/api/events/jamroma/presence', {
        method: 'POST', headers,
        body: JSON.stringify({
          lat: pos.coords.latitude, lon: pos.coords.longitude,
          sharing_enabled: true,
          ...(user ? {} : { display_name: anonName || 'Rider' }),
        }),
      }).catch(() => {});
    };
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSharing(true);
        sendPosition(pos);
        // Aggiorna mappa subito cosi l'utente si vede
        setTimeout(fetchRiders, 1500);
        presenceInterval.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition(sendPosition, () => {}, {
            enableHighAccuracy: false, timeout: 10000, maximumAge: 60000,
          });
        }, 120_000);
      },
      (err) => {
        if (err.code === 1) setSharingError('Permesso posizione negato');
        else setSharingError('Posizione non disponibile');
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const stopSharing = () => {
    setSharing(false);
    if (presenceInterval.current) { clearInterval(presenceInterval.current); presenceInterval.current = null; }
  };

  useEffect(() => () => { if (presenceInterval.current) clearInterval(presenceInterval.current); }, []);

  /* ── Inline keyframes via <style> ── */
  const jamStyles = `
    @keyframes jamPulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.15); opacity: 0.85; }
    }
    @keyframes riderPing {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(232,93,117,0.6); }
      70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(232,93,117,0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(232,93,117,0); }
    }
    .jam-map-tiles {
      filter: sepia(0.25) hue-rotate(270deg) saturate(1.6) contrast(0.85) brightness(0.8);
    }
    .jam-map-wrap::after {
      content: '';
      position: absolute; inset: 0;
      background: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E");
      background-size: 200px 200px;
      pointer-events: none;
      z-index: 1;
      mix-blend-mode: overlay;
      border-radius: 12px;
    }
    .jam-meeting-marker {
      animation: jamPulse 2s ease-in-out infinite;
    }
    .jam-rider-marker {
      animation: riderPing 2s ease-in-out infinite;
    }
  `;

  return (
    <div style={{ background: C.dark, minHeight: '100dvh', color: C.cream }}>
      <style>{jamStyles}</style>

      {/* ── Hero: Poster ── */}
      <div style={{ position: 'relative', overflow: 'hidden', maxWidth: 640, margin: '0 auto' }}>
        <img
          src={JAM_ROMA.posterUrl}
          alt={JAM_ROMA.title}
          style={{ width: '100%', maxHeight: 520, objectFit: 'cover', display: 'block' }}
        />
        {/* Gradient fade into dark */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: `linear-gradient(transparent 0%, ${C.dark} 100%)`,
          padding: '80px 20px 24px',
        }}>
          {/* Stato evento */}
          <div style={{
            display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            padding: '3px 8px', borderRadius: 4, marginBottom: 8, letterSpacing: '0.08em',
            textTransform: 'uppercase',
            background: jamState === 'live' ? C.green : jamState === 'after' ? `${C.cream}20` : `${C.yellow}20`,
            color: jamState === 'live' ? '#fff' : jamState === 'after' ? `${C.cream}60` : C.yellow,
          }}>
            {jamState === 'before' ? 'PROSSIMAMENTE' : jamState === 'live' ? 'LIVE ORA' : 'CONCLUSA'}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: C.yellow,
            textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6,
          }}>
            {JAM_ROMA.subtitle}
          </div>
          <h1 style={{
            fontFamily: 'var(--font-mono)', fontSize: 30, color: C.cream,
            margin: '0 0 8px', lineHeight: 1.05, letterSpacing: '-0.01em',
          }}>
            {JAM_ROMA.title}
          </h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: C.coral, fontWeight: 600 }}>
            {JAM_ROMA.dateLabel}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'rgba(242,232,213,0.6)', marginTop: 2 }}>
            {JAM_ROMA.locationLabel}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 20px 40px' }}>

        {/* Counter bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 0', borderBottom: `1px solid ${C.darkViolet}`,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: C.cream }}>
            <span style={{ color: C.yellow, fontWeight: 700, fontSize: 24 }}>{rsvpCount}</span>
            {' '}rider {jamState === 'after' ? 'hanno partecipato' : 'vengono'}
          </div>
          {riders.length > 0 && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 12, color: C.green,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: C.green,
                display: 'inline-block', animation: 'jamPulse 1.5s infinite',
              }} />
              {riders.length} live
            </div>
          )}
        </div>

        {/* ── CTA ── */}
        <div style={{ padding: '20px 0', display: 'grid', gap: 12 }}>

          {/* Nome per anonimi (solo se confermato non loggato) */}
          {user === null && jamState !== 'after' && (
            <input type="text" value={anonName}
              onChange={e => setAnonName(e.target.value.slice(0, 40))}
              placeholder="Il tuo nome"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: C.darkViolet, border: `1px solid ${C.violet}`,
                borderRadius: 8, color: C.cream, fontFamily: 'var(--font-mono)',
                fontSize: 15, padding: '12px 14px', outline: 'none',
              }}
            />
          )}

          {/* "Io vengo" — before + live, se non gia confermato */}
          {jamState !== 'after' && !rsvpDone && (
            <button onClick={handleRsvp}
              disabled={rsvpLoading || (!user && anonName.trim().length < 2)}
              style={{
                width: '100%', fontFamily: 'var(--font-mono)', fontSize: 16,
                background: C.yellow, color: C.dark, border: 'none',
                borderRadius: 8, padding: '15px', cursor: 'pointer',
                fontWeight: 700, letterSpacing: '0.04em',
                opacity: rsvpLoading ? 0.6 : 1, textTransform: 'uppercase',
              }}>
              {rsvpLoading ? '...' : jamState === 'live' ? 'SONO ALLA JAM' : 'IO VENGO'}
            </button>
          )}
          {rsvpError && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#ff6666', textAlign: 'center' }}>
              {rsvpError}
            </div>
          )}

          {/* Conferma RSVP + annulla */}
          {jamState !== 'after' && rsvpDone && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderRadius: 8,
              background: `${C.green}18`, border: `1px solid ${C.green}50`,
              fontFamily: 'var(--font-mono)', fontSize: 13,
            }}>
              <span style={{ color: C.green }}>
                Ci sei! {jamState === 'before' ? 'Ci vediamo il 6 giugno.' : 'Buona jam!'}
              </span>
              {user && (
                <button onClick={handleCancelRsvp} disabled={rsvpLoading}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: `${C.cream}40`, background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0, whiteSpace: 'nowrap',
                  }}>
                  {rsvpLoading ? '...' : 'Non posso piu'}
                </button>
              )}
            </div>
          )}

          {/* Condivisione attiva — nota + bottone stop */}
          {jamState !== 'after' && sharing && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 8,
              background: `${C.coral}12`, border: `1px solid ${C.coral}30`,
              fontFamily: 'var(--font-mono)',
            }}>
              <span style={{ fontSize: 12, color: `${C.cream}60`, lineHeight: 1.4 }}>
                📍 Posizione condivisa
              </span>
              <button onClick={stopSharing}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  color: C.coral, background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0, whiteSpace: 'nowrap', fontWeight: 600,
                }}>
                Interrompi
              </button>
            </div>
          )}

          {/* After */}
          {jamState === 'after' && (
            <div style={{
              textAlign: 'center', padding: '24px', borderRadius: 10,
              background: C.darkViolet, border: `1px solid ${C.violet}40`,
              fontFamily: 'var(--font-mono)',
            }}>
              <div style={{ fontSize: 44, marginBottom: 8 }}>🏴</div>
              <div style={{ fontSize: 18, color: C.yellow, marginBottom: 6, fontWeight: 700 }}>JAM CONCLUSA</div>
              <div style={{ fontSize: 13, color: 'rgba(242,232,213,0.5)' }}>
                {rsvpCount} rider al Colle del Cemento V4.
              </div>
            </div>
          )}
        </div>

        {/* ── RSVP list ── */}
        {rsvps.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SectionLabel>Chi viene</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {rsvps.slice(0, 30).map(r => (
                <div key={r.id} style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  background: C.darkViolet, border: `1px solid ${C.violet}30`,
                  borderRadius: 20, padding: '5px 12px', color: C.cream,
                  whiteSpace: 'nowrap',
                }}>
                  {r.display_name}
                </div>
              ))}
              {rsvps.length > 30 && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: `${C.cream}60`, padding: '5px 12px' }}>
                  +{rsvps.length - 30}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Event Map ── */}
        <div style={{ marginBottom: 28 }}>
          <SectionLabel>{jamState === 'live' ? 'Mappa live' : 'Spot della jam'}</SectionLabel>
          <EventMap
            spots={spots}
            riders={riders}
            sharing={sharing}
            sharingError={sharingError}
            onStartSharing={startSharing}
            onStopSharing={stopSharing}
            showPresenceControls={jamState !== 'after'}
          />
        </div>

        {/* ── Spot list con foto + portami qui ── */}
        <div style={{ marginBottom: 28 }}>
          <SectionLabel>Spot della jam</SectionLabel>
          <div style={{ display: 'grid', gap: 10 }}>
            {spots.map(s => (
              <div key={s.id} style={{
                background: C.darkViolet,
                border: `1px solid ${s.meetingPoint ? C.yellow : C.violet + '30'}`,
                borderRadius: 12, overflow: 'hidden',
              }}>
                {/* Foto spot */}
                {s.coverUrl && (
                  <a href={`/map/spot/${s.slug}?from=jamroma`} style={{ display: 'block' }}>
                    <img src={s.coverUrl} alt={s.label}
                      style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                  </a>
                )}
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: s.meetingPoint ? C.yellow : C.violet,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13,
                    }}>
                      {s.meetingPoint ? '📍' : '🏴'}
                    </div>
                    <div>
                      <a href={`/map/spot/${s.slug}?from=jamroma`} style={{
                        fontFamily: 'var(--font-mono)', fontSize: 14, textDecoration: 'none',
                        color: s.meetingPoint ? C.yellow : C.cream, fontWeight: 600,
                      }}>
                        {s.label}
                      </a>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: `${C.cream}50` }}>
                        {s.description}
                      </div>
                    </div>
                  </div>
                  {/* Portami qui — Google Maps directions */}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontFamily: 'var(--font-mono)', fontSize: 12,
                      color: C.coral, textDecoration: 'none',
                      padding: '5px 10px', borderRadius: 6,
                      background: `${C.coral}12`, border: `1px solid ${C.coral}30`,
                      marginTop: 4,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>🧭</span> Portami qui
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Back ── */}
        <div style={{ textAlign: 'center', paddingBottom: 20 }}>
          <a href="/map" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: C.coral, textDecoration: 'none' }}>
            ← Torna alla mappa
          </a>
        </div>
      </div>

      {/* ── Consent Modal ── */}
      {showConsentModal && (
        <>
          <div
            onClick={() => setShowConsentModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 999, backdropFilter: 'blur(4px)' }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
            background: C.darkViolet, borderTop: `2px solid ${C.coral}`,
            borderRadius: '16px 16px 0 0',
            padding: '28px 24px', paddingBottom: 'calc(28px + env(safe-area-inset-bottom))',
            animation: 'slideUp 0.25s ease-out',
          }}>
            <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>📍</div>
            <h3 style={{
              fontFamily: 'var(--font-mono)', fontSize: 18, color: C.cream,
              textAlign: 'center', margin: '0 0 12px',
            }}>
              Mostrami sulla mappa
            </h3>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: 13, color: `${C.cream}90`,
              textAlign: 'center', lineHeight: 1.6, margin: '0 0 8px',
            }}>
              La tua posizione sara visibile agli altri rider sulla mappa della jam.
            </p>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, color: `${C.cream}50`,
              textAlign: 'center', lineHeight: 1.5, margin: '0 0 24px',
            }}>
              Non salviamo lo storico. La posizione si aggiorna in tempo reale
              finche tieni la pagina aperta, e sparisce dopo 2 minuti se chiudi.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              <button onClick={doStartSharing}
                style={{
                  width: '100%', fontFamily: 'var(--font-mono)', fontSize: 16,
                  background: C.coral, color: '#fff', border: 'none',
                  borderRadius: 10, padding: '15px', cursor: 'pointer',
                  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                SI, CONDIVIDI POSIZIONE
              </button>
              <button onClick={() => setShowConsentModal(false)}
                style={{
                  width: '100%', fontFamily: 'var(--font-mono)', fontSize: 13,
                  background: 'transparent', color: `${C.cream}60`, border: 'none',
                  padding: '12px', cursor: 'pointer',
                }}>
                No, grazie
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Section Label
═══════════════════════════════════════════════ */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 11, color: C.violet,
      textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Event Map — Poster-styled Leaflet
═══════════════════════════════════════════════ */
/** Escape HTML per popup Leaflet (anti-XSS) */
function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function EventMap({ spots, riders, sharing, sharingError, onStartSharing, onStopSharing, showPresenceControls }: {
  spots: Spot[]; riders: Rider[];
  sharing: boolean; sharingError: string;
  onStartSharing: () => void; onStopSharing: () => void;
  showPresenceControls: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<import('leaflet').Layer[]>([]);
  const onStartRef = useRef(onStartSharing);
  onStartRef.current = onStartSharing;
  const sharingRef = useRef(sharing);
  sharingRef.current = sharing;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current!, {
        center: [JAM_ROMA.center.lat, JAM_ROMA.center.lon],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      });

      // OSM tiles con filtro CSS poster (affidabile, no API key)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        className: 'jam-map-tiles',
      }).addTo(map);

      // Zoom control positioned top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      mapRef.current = map;
    });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then((L) => {
      const map = mapRef.current!;
      markersRef.current.forEach(m => map.removeLayer(m));
      markersRef.current = [];

      // Spot markers — poster styled
      spots.forEach(s => {
        if (s.meetingPoint) {
          // Meeting point: large pulsing marker with clear CTA
          const icon = L.divIcon({
            html: `<div class="jam-meeting-marker" style="
              display:flex;flex-direction:column;align-items:center;gap:2px;
              cursor:pointer;
            ">
              <div style="
                width:64px;height:64px;border-radius:50%;
                background:${C.yellow};
                border:4px solid ${C.dark};
                box-shadow:0 0 24px ${C.yellow}90, 0 0 48px ${C.yellow}40;
                display:flex;align-items:center;justify-content:center;
                font-size:28px;
              ">📍</div>
              <div style="
                font-family:var(--font-mono);font-size:11px;font-weight:800;
                color:${C.yellow};letter-spacing:0.08em;
                text-shadow:0 1px 4px rgba(0,0,0,0.8);
                white-space:nowrap;
              ">START</div>
            </div>`,
            className: '',
            iconSize: [64, 80],
            iconAnchor: [32, 40],
          });
          const m = L.marker([s.lat, s.lon], { icon, zIndexOffset: 1000 })
            .addTo(map);
          m.on('click', () => {
            if (!sharingRef.current) onStartRef.current();
          });
          markersRef.current.push(m);
        } else {
          // Regular spot: violet circle with flag
          const icon = L.divIcon({
            html: `<div style="
              width:32px;height:32px;border-radius:50%;
              background:${C.violet};
              border:3px solid ${C.darkViolet};
              box-shadow:0 2px 8px rgba(0,0,0,0.4);
              display:flex;align-items:center;justify-content:center;
              font-size:14px;
            ">🏴</div>`,
            className: '',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });
          const m = L.marker([s.lat, s.lon], { icon })
            .bindPopup(`<div style="font-family:monospace"><strong>${esc(s.label)}</strong><br/><span style="font-size:12px;color:#666">${esc(s.description)}</span></div>`)
            .addTo(map);
          markersRef.current.push(m);
        }
      });

      // Rider markers — coral pulsing dots with initial
      riders.forEach(r => {
        const initial = esc(r.display_name[0]?.toUpperCase() ?? '?');
        const icon = L.divIcon({
          html: `<div class="jam-rider-marker" style="
            width:28px;height:28px;border-radius:50%;
            background:${C.coral};
            border:2px solid ${C.cream};
            display:flex;align-items:center;justify-content:center;
            font-size:11px;color:#fff;font-family:var(--font-mono);font-weight:700;
            box-shadow:0 0 12px ${C.coral}60;
          ">${initial}</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        const m = L.marker([r.lat, r.lon], { icon })
          .bindPopup(`<div style="font-family:monospace;color:${C.coral};font-weight:600">${esc(r.display_name)}</div>`)
          .addTo(map);
        markersRef.current.push(m);
      });
    });
  }, [spots, riders]);

  return (
    <div className="jam-map-wrap" style={{
      position: 'relative', borderRadius: 12, overflow: 'hidden',
      border: `2px solid ${C.violet}40`,
      boxShadow: `0 4px 24px rgba(0,0,0,0.4), inset 0 0 40px ${C.violet}10`,
    }}>
      <div ref={containerRef} style={{ width: '100%', height: 380 }} />
      {/* Vignette overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at center, transparent 50%, ${C.dark}90 100%)`,
        pointerEvents: 'none', zIndex: 2, borderRadius: 12,
      }} />
      {/* Overlay mappa: nascondi posizione (quando attiva) + errori */}
      {showPresenceControls && (
        <div style={{
          position: 'absolute', bottom: 12, left: 12, right: 12,
          zIndex: 3, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center',
        }}>
          {sharing && (
            <button onClick={onStopSharing}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                background: 'rgba(0,0,0,0.7)', color: '#ff6666',
                border: '1px solid rgba(255,68,68,0.4)',
                borderRadius: 20, padding: '8px 16px', cursor: 'pointer',
                backdropFilter: 'blur(4px)',
              }}>
              Nascondi posizione
            </button>
          )}
          {sharingError && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff6666',
              background: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: '4px 10px',
            }}>
              {sharingError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
