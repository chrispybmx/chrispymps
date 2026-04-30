'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/components/Toast';

interface SpotSession {
  spot: { id: string; name: string; slug: string; city?: string };
  riders: { username: string }[];
}

export default function SessioniClient() {
  const user = useUser();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SpotSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [mySession, setMySession] = useState<string | null>(null); // spot_id
  const [spots, setSpots] = useState<{ id: string; name: string; city?: string }[]>([]);
  const [selectedSpot, setSelectedSpot] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      const j = await res.json();
      if (j.ok) {
        setSessions(j.data ?? []);
        // Check if current user has active session
        if (user) {
          for (const s of j.data ?? []) {
            if (s.riders.some((r: { username: string }) => r.username === user.username)) {
              setMySession(s.spot.id);
              return;
            }
          }
        }
        setMySession(null);
      }
    } catch {}
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Load spots for dropdown
  useEffect(() => {
    if (!showJoinForm) return;
    fetch('/api/spots')
      .then(r => r.json())
      .then(j => {
        if (j.ok) {
          const sorted = (j.data ?? [])
            .map((s: { id: string; name: string; city?: string }) => ({ id: s.id, name: s.name, city: s.city }))
            .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
          setSpots(sorted);
        }
      })
      .catch(() => {});
  }, [showJoinForm]);

  const joinSession = async () => {
    if (!user || !selectedSpot) return;
    setJoining(true);

    // Get GPS position
    if (!('geolocation' in navigator)) {
      toast('Geolocalizzazione non disponibile', 'error');
      setJoining(false);
      return;
    }

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          spot_id: selectedSpot,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          access_token: user.accessToken,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        toast(j.message, 'success');
        setShowJoinForm(false);
        setSelectedSpot('');
        fetchSessions();
      } else {
        toast(j.error, 'error');
      }
    } catch {
      toast('Abilita la posizione per verificare che sei allo spot', 'error');
    }
    setJoining(false);
  };

  const leaveSession = async () => {
    if (!user) return;
    setJoining(true);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave', access_token: user.accessToken }),
      });
      const j = await res.json();
      if (j.ok) {
        toast('Sessione chiusa', 'info');
        setMySession(null);
        fetchSessions();
      }
    } catch {}
    setJoining(false);
  };

  return (
    <div style={{ background: 'var(--black)', minHeight: '100dvh' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--gray-700)', background: 'rgba(10,10,10,0.98)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ color: 'var(--gray-400)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            ← Mappa
          </Link>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--orange)' }}>
            🔴 SESSIONI
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 60px' }}>

        {/* CTA */}
        {user && !mySession && !showJoinForm && (
          <button
            onClick={() => setShowJoinForm(true)}
            style={{
              width: '100%', padding: '14px', marginBottom: 20,
              fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700,
              background: 'var(--orange)', color: '#000', border: 'none',
              borderRadius: 10, cursor: 'pointer', letterSpacing: '0.04em',
              boxShadow: '0 2px 16px rgba(255,106,0,0.3)',
            }}
          >
            🔴 SONO IN SESSION
          </button>
        )}

        {/* Active session banner */}
        {user && mySession && (
          <div style={{
            padding: '14px 16px', marginBottom: 20,
            background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.3)',
            borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff3333', boxShadow: '0 0 8px #ff3333', flexShrink: 0, animation: 'pulse-dot 2s infinite' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)' }}>
                Sei in session!
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>
                Scade automaticamente tra qualche ora
              </div>
            </div>
            <button
              onClick={leaveSession} disabled={joining}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 12,
                background: 'transparent', border: '1px solid var(--gray-600)',
                borderRadius: 6, color: 'var(--gray-400)', padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              Esci
            </button>
          </div>
        )}

        {/* Join form */}
        {showJoinForm && (
          <div style={{
            padding: '18px', marginBottom: 20,
            background: 'var(--gray-800)', border: '1px solid var(--gray-700)',
            borderRadius: 12,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--orange)', marginBottom: 12 }}>
              Scegli lo spot dove stai ridando
            </div>

            <select
              value={selectedSpot}
              onChange={e => setSelectedSpot(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', marginBottom: 12,
                background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
                borderRadius: 6, color: 'var(--bone)', fontFamily: 'var(--font-mono)',
                fontSize: 14, outline: 'none',
              }}
            >
              <option value="">— Seleziona spot —</option>
              {spots.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.city ? ` — ${s.city}` : ''}
                </option>
              ))}
            </select>

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)', marginBottom: 14 }}>
              📍 La tua posizione verrà verificata — devi essere entro 1 km dallo spot
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={joinSession}
                disabled={!selectedSpot || joining}
                style={{
                  flex: 1, padding: '10px', fontFamily: 'var(--font-mono)', fontSize: 14,
                  fontWeight: 700, background: 'var(--orange)', color: '#000', border: 'none',
                  borderRadius: 6, cursor: 'pointer',
                  opacity: (!selectedSpot || joining) ? 0.4 : 1,
                }}
              >
                {joining ? '⏳ Verifico...' : '🔴 Entra in session'}
              </button>
              <button
                onClick={() => { setShowJoinForm(false); setSelectedSpot(''); }}
                style={{
                  padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 14,
                  background: 'transparent', border: '1px solid var(--gray-600)',
                  borderRadius: 6, color: 'var(--gray-400)', cursor: 'pointer',
                }}
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {/* Not logged in */}
        {user === null && (
          <div style={{
            padding: '16px', marginBottom: 20,
            background: 'rgba(255,106,0,0.06)', border: '1px solid rgba(255,106,0,0.2)',
            borderRadius: 10, textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)', marginBottom: 4 }}>
              🔑 Accedi per entrare in session
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)' }}>
              Serve un account per mostrare il tuo username
            </div>
          </div>
        )}

        {/* Active sessions list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'var(--font-mono)', color: 'var(--orange)', fontSize: 14 }}>
            CARICAMENTO...
          </div>
        ) : sessions.length > 0 ? (
          <>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              🔴 SPOT ATTIVI ORA ({sessions.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sessions.map(s => (
                <Link
                  key={s.spot.id}
                  href={`/map/spot/${s.spot.slug}`}
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  <div style={{
                    background: 'var(--gray-800)', border: '1px solid var(--gray-700)',
                    borderRadius: 10, padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    {/* Live dot */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: 'rgba(255,51,51,0.1)', border: '1px solid rgba(255,51,51,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3333', boxShadow: '0 0 6px #ff3333' }} />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)', marginBottom: 3 }}>
                        {s.spot.name}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {s.spot.city && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)' }}>
                            📍 {s.spot.city}
                          </span>
                        )}
                        {s.riders.map(r => (
                          <span key={r.username} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)' }}>
                            @{r.username}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Count */}
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)',
                      flexShrink: 0, minWidth: 28, textAlign: 'center',
                    }}>
                      {s.riders.length}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: 50 }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>🔴</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--bone)', marginBottom: 8 }}>
              Nessuno in session
            </div>
            <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>
              Sii il primo a iniziare una session!
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
