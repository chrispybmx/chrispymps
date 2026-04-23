'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TIPI_SPOT, CONDIZIONI } from '@/lib/constants';
import type { SpotType } from '@/lib/types';

const FAVS_KEY = 'cmaps_favs_v1';

interface FavSpot {
  id:          string;
  slug:        string;
  name:        string;
  type:        SpotType;
  city?:       string;
  condition:   string;
  spot_photos?: { url: string; position: number }[];
}

interface Props {
  profileUsername: string;
  profileId:       string; // auth user UUID — per ownership check affidabile
}

export default function FavoritesSection({ profileUsername, profileId }: Props) {
  const [isOwn,   setIsOwn]   = useState(false);
  const [spots,   setSpots]   = useState<FavSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [empty,   setEmpty]   = useState(false);

  useEffect(() => {
    import('@/lib/supabase-browser').then(({ supabaseBrowser }) => {
      supabaseBrowser().auth.getSession().then(async ({ data }) => {
        const u = data.session?.user;
        if (!u) { setLoading(false); return; }

        /* Ownership: confronta per UUID (sicuro) oppure per username come fallback
           (user_metadata.username potrebbe non essere settato su alcuni auth flow) */
        const uname = u.user_metadata?.username ?? u.email?.split('@')[0] ?? '';
        const own   = u.id === profileId || uname === profileUsername;
        setIsOwn(own);
        if (!own) { setLoading(false); return; }

        // Leggi preferiti da localStorage
        let ids: string[] = [];
        try { ids = JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]'); } catch {}

        if (ids.length === 0) { setEmpty(true); setLoading(false); return; }

        try {
          const res = await fetch(`/api/favorites?ids=${ids.join(',')}`);
          const j   = await res.json();
          if (j.ok) {
            setSpots(j.data);
            if (j.data.length === 0) setEmpty(true);
          }
        } catch { setEmpty(true); }
        setLoading(false);
      });
    }).catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, profileUsername]);

  if (!isOwn || loading) return null;

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 12,
        color: 'var(--gray-400)', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 14,
        borderTop: '1px solid var(--gray-700)', paddingTop: 24,
      }}>
        ❤️ I MIEI PREFERITI{spots.length > 0 ? ` (${spots.length})` : ''}
      </div>

      {empty || spots.length === 0 ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-500)', padding: '12px 0' }}>
          Nessun preferito ancora — premi ❤️ su uno spot per salvarlo.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {spots.map(spot => <SpotTile key={spot.id} spot={spot} />)}
        </div>
      )}
    </div>
  );
}

function SpotTile({ spot }: { spot: FavSpot }) {
  const tipo   = TIPI_SPOT[spot.type];
  const cond   = CONDIZIONI[spot.condition as keyof typeof CONDIZIONI];
  const cover  = spot.spot_photos?.sort((a, b) => a.position - b.position)[0]?.url;
  const isDead = spot.condition !== 'alive';

  return (
    <Link href={`/map/spot/${spot.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        background: 'var(--gray-800)',
        border: '1px solid var(--gray-700)',
        borderRadius: 8, overflow: 'hidden',
        opacity: isDead ? 0.65 : 1,
      }}>
        <div style={{
          height: 110, background: 'var(--gray-700)',
          overflow: 'hidden', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {cover
            ? <img src={cover} alt={spot.name} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isDead ? 'grayscale(0.5)' : 'none' }} loading="lazy" />
            : <span style={{ fontSize: 36 }}>{tipo.emoji}</span>}
          <div style={{
            position: 'absolute', top: 6, right: 6,
            background: cond?.bg ?? 'rgba(0,0,0,0.6)',
            color: cond?.color ?? '#fff',
            fontFamily: 'var(--font-mono)', fontSize: 9,
            padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase',
          }}>
            {cond?.label ?? spot.condition}
          </div>
        </div>
        <div style={{ padding: '8px 10px' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 13,
            color: 'var(--bone)', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3,
          }}>
            {spot.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: tipo.color }}>
              {tipo.emoji} {tipo.label}
            </span>
            {spot.city && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>
                · {spot.city}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
