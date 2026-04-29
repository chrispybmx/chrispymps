'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TIPI_SPOT } from '@/lib/constants';
import type { SpotType } from '@/lib/types';

interface FavSpot {
  id: string; slug: string; name: string;
  type: SpotType; city?: string;
  spot_photos?: { url: string; position: number }[];
}

interface Props {
  profileUsername: string;
  profileId: string;
}

/**
 * Shows favorites for ANY profile (not just own).
 * Fetches via API using profile user ID.
 */
export default function FavoritesSection({ profileUsername, profileId }: Props) {
  const [spots, setSpots] = useState<FavSpot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch favorites for this profile user
    fetch(`/api/favorites?user_id=${profileId}`)
      .then(r => r.json())
      .then(j => { if (j.ok) setSpots(j.data ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profileId]);

  if (loading) return null;
  if (spots.length === 0) return null;

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 12,
        color: 'var(--gray-400)', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 14,
        borderTop: '1px solid var(--gray-700)', paddingTop: 24,
      }}>
        ❤️ PREFERITI DI @{profileUsername.toUpperCase()} ({spots.length})
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {spots.map(spot => {
          const tipo = TIPI_SPOT[spot.type];
          const cover = spot.spot_photos?.sort((a, b) => a.position - b.position)?.[0]?.url;
          return (
            <Link key={spot.id} href={`/map/spot/${spot.slug}`} style={{ textDecoration: 'none', display: 'block', minWidth: 0 }}>
              <div style={{ background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ width: '100%', paddingBottom: '100%', background: 'var(--gray-700)', overflow: 'hidden', position: 'relative' }}>
                  {cover
                    ? <img src={cover} alt={spot.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                    : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 36 }}>{tipo.emoji}</span></div>}
                </div>
                <div style={{ padding: '8px 10px', height: 52, overflow: 'hidden' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{spot.name}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tipo.emoji} {tipo.label}{spot.city ? ` · ${spot.city}` : ''}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
