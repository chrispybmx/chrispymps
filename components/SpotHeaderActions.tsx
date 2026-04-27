'use client';

import { useState, useEffect, useRef } from 'react';

const FAVS_KEY  = 'cmaps_favs_v1';
const ratingKey = (id: string) => `cmaps_rating_${id}`;

function isFavLocal(id: string): boolean {
  try { return (JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]') as string[]).includes(id); } catch { return false; }
}
function toggleFavLocal(id: string): boolean {
  try {
    const favs: string[] = JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]');
    const i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.push(id);
    localStorage.setItem(FAVS_KEY, JSON.stringify(favs));
    return i < 0;
  } catch { return false; }
}
function getMyRating(id: string): number { try { return Math.min(5, Math.max(0, parseInt(localStorage.getItem(ratingKey(id)) ?? '0', 10) || 0)); } catch { return 0; } }
function saveRating(id: string, r: number): void { try { localStorage.setItem(ratingKey(id), String(r)); } catch {} }

interface Props { spotId: string }

export default function SpotHeaderActions({ spotId }: Props) {
  const [myRating,     setMyRating]   = useState(0);
  const [hoverStar,    setHoverStar]  = useState(0);
  const [isFaved,      setIsFaved]    = useState(false);
  const [riderCount,   setRiderCount] = useState(0);
  const [hasRidden,    setHasRidden]  = useState(false);
  const [riderLoading, setLoading]    = useState(false);
  const tokenRef = useRef<string | null>(null);
  const isAuthRef = useRef(false);  // true = logged in, use Supabase

  useEffect(() => {
    setMyRating(getMyRating(spotId));

    import('@/lib/supabase-browser').then(({ supabaseBrowser }) => {
      supabaseBrowser().auth.getSession().then(async ({ data }) => {
        const t = data.session?.access_token ?? null;
        tokenRef.current = t;
        isAuthRef.current = !!t;

        if (t) {
          /* Utente loggato: leggi preferito da Supabase */
          try {
            const res = await fetch(`/api/favorites`, {
              headers: { Authorization: `Bearer ${t}` },
            });
            const j = await res.json();
            if (j.ok) setIsFaved((j.ids as string[]).includes(spotId));
          } catch {
            /* fallback localStorage */
            setIsFaved(isFavLocal(spotId));
          }

          /* "Ho girato" */
          fetch(`/api/riders?spot_id=${spotId}`, { headers: { Authorization: `Bearer ${t}` } })
            .then(r => r.json()).then(j => { if (j.ok) { setRiderCount(j.count); setHasRidden(j.hasRidden); } }).catch(() => {});
        } else {
          /* Anonimo: localStorage */
          setIsFaved(isFavLocal(spotId));
          fetch(`/api/riders?spot_id=${spotId}`)
            .then(r => r.json()).then(j => { if (j.ok) setRiderCount(j.count); }).catch(() => {});
        }
      });
    }).catch(() => {
      setIsFaved(isFavLocal(spotId));
    });
  }, [spotId]);

  const handleStar = (star: number) => {
    const next = star === myRating ? 0 : star;
    saveRating(spotId, next);
    setMyRating(next);
  };

  const handleFav = async () => {
    const t = tokenRef.current;
    if (t && isAuthRef.current) {
      /* Ottimistic update */
      const next = !isFaved;
      setIsFaved(next);
      try {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
          body: JSON.stringify({ spot_id: spotId }),
        });
        const j = await res.json();
        if (j.ok) {
          setIsFaved(j.isFaved);
        } else {
          /* Rollback */
          setIsFaved(!next);
        }
      } catch {
        setIsFaved(!next);
      }
    } else {
      /* Anonimo: localStorage */
      const added = toggleFavLocal(spotId);
      setIsFaved(added);
    }
  };

  const handleRider = async () => {
    const t = tokenRef.current;
    if (!t) return;
    setLoading(true);
    try {
      const res = await fetch('/api/riders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ spot_id: spotId }),
      });
      const j = await res.json();
      if (j.ok) { setHasRidden(j.hasRidden); setRiderCount(j.count); }
    } catch {}
    setLoading(false);
  };

  const displayStars = hoverStar || myRating;
  const token = tokenRef.current;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      marginBottom: 20,
      background: 'var(--gray-800)',
      border: '1px solid var(--gray-700)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>

      {/* ── STELLE ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 8px',
        gap: 4,
        borderRight: '1px solid var(--gray-700)',
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {myRating > 0 ? `${myRating} / 5` : 'vota'}
        </div>
        <div style={{ display: 'flex', gap: 1 }}>
          {[1,2,3,4,5].map(star => (
            <button
              key={star}
              onMouseEnter={() => setHoverStar(star)}
              onMouseLeave={() => setHoverStar(0)}
              onClick={() => handleStar(star)}
              style={{
                background: 'none', border: 'none', padding: '1px',
                cursor: 'pointer', fontSize: 18, lineHeight: 1,
                color: star <= displayStars ? '#ffce4d' : 'var(--gray-600)',
                transition: 'color 0.1s, transform 0.1s',
                transform: star === hoverStar ? 'scale(1.25)' : 'scale(1)',
              }}
            >★</button>
          ))}
        </div>
      </div>

      {/* ── HO GIRATO QUI ── */}
      <button
        onClick={handleRider}
        disabled={!token || riderLoading}
        title={!token ? 'Accedi per segnare che hai girato qui' : undefined}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          padding: '12px 8px',
          background: hasRidden ? 'rgba(255,106,0,0.08)' : 'transparent',
          border: 'none',
          borderRight: '1px solid var(--gray-700)',
          cursor: token ? 'pointer' : 'default',
          transition: 'background 0.15s',
          opacity: riderLoading ? 0.5 : 1,
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>🛹</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: hasRidden ? 'var(--orange)' : 'var(--gray-400)',
          textTransform: 'uppercase', letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
        }}>
          {hasRidden ? 'ho girato ✓' : 'ho girato qui'}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--gray-600)' }}>
          {riderCount > 0 ? `${riderCount} rider` : '—'}
        </span>
      </button>

      {/* ── SALVA ── */}
      <button
        onClick={handleFav}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          padding: '12px 8px',
          background: isFaved ? 'rgba(255,80,80,0.06)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        <span style={{
          fontSize: 22, lineHeight: 1,
          transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1)',
          transform: isFaved ? 'scale(1.2)' : 'scale(1)',
          display: 'block',
        }}>
          {isFaved ? '❤️' : '🤍'}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: isFaved ? '#ff6b6b' : 'var(--gray-400)',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {isFaved ? 'salvato' : 'salva'}
        </span>
      </button>

    </div>
  );
}
