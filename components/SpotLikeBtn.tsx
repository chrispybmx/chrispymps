'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';

interface Props {
  spotId: string;
  initialCount?: number;
}

export default function SpotLikeBtn({ spotId, initialCount = 0 }: Props) {
  const user = useUser();
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/spot-likes?spot_id=${spotId}`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    })
      .then(r => r.json())
      .then(j => { if (j.ok) { setCount(j.count); setLiked(j.hasLiked); } })
      .catch(() => {});
  }, [spotId, user?.id]); // eslint-disable-line

  const toggle = async () => {
    if (!user || loading) return;
    setLoading(true);
    const prev = liked;
    setLiked(!prev);
    setCount(c => prev ? c - 1 : c + 1);

    try {
      const res = await fetch('/api/spot-likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` },
        body: JSON.stringify({ spot_id: spotId }),
      });
      const j = await res.json();
      if (j.ok) { setLiked(j.hasLiked); setCount(j.count); }
      else { setLiked(prev); setCount(c => prev ? c + 1 : c - 1); }
    } catch { setLiked(prev); setCount(c => prev ? c + 1 : c - 1); }
    finally { setLoading(false); }
  };

  return (
    <button
      onClick={toggle}
      disabled={!user}
      title={!user ? 'Accedi per votare' : liked ? 'Rimuovi voto' : 'Vota spot 🔥'}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 16px', borderRadius: 8,
        border: liked ? '1px solid var(--orange)' : '1px solid var(--gray-600)',
        background: liked ? 'rgba(255,106,0,0.12)' : 'transparent',
        color: liked ? 'var(--orange)' : 'var(--gray-400)',
        fontFamily: 'var(--font-mono)', fontSize: 14,
        cursor: user ? 'pointer' : 'default',
        transition: 'all 0.15s',
        fontWeight: liked ? 700 : 400,
      }}
    >
      🔥 {count > 0 ? count : ''}
    </button>
  );
}
