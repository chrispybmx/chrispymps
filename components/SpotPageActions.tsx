'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { useFavorites } from '@/hooks/useFavorites';
import { useToast } from './Toast';

interface Props {
  spotId: string;
  initialLikes: number;
}

export default function SpotPageActions({ spotId, initialLikes }: Props) {
  const user = useUser();
  const { isFav, toggleFav } = useFavorites();
  const { toast } = useToast();

  const [likeCount, setLikeCount] = useState(initialLikes);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  // Check if user liked this spot
  useEffect(() => {
    if (!user) return;
    fetch(`/api/spot-likes?spot_id=${spotId}`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    })
      .then(r => r.json())
      .then(j => { if (j.ok) { setLikeCount(j.count); setLiked(j.hasLiked); } })
      .catch(() => {});
  }, [spotId, user?.id]); // eslint-disable-line

  const handleLike = async () => {
    if (!user || likeLoading) return;
    setLikeLoading(true);
    const prev = liked;
    setLiked(!prev);
    setLikeCount(c => prev ? c - 1 : c + 1);
    try {
      const res = await fetch('/api/spot-likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` },
        body: JSON.stringify({ spot_id: spotId }),
      });
      const j = await res.json();
      if (j.ok) { setLiked(j.hasLiked); setLikeCount(j.count); }
      else { setLiked(prev); setLikeCount(c => prev ? c + 1 : c - 1); }
    } catch { setLiked(prev); setLikeCount(c => prev ? c + 1 : c - 1); }
    finally { setLikeLoading(false); }
  };

  const handleFav = () => {
    const added = toggleFav(spotId);
    toast(added ? 'Salvato nei preferiti' : 'Rimosso dai preferiti', added ? 'success' : 'info');
  };

  const faved = isFav(spotId);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {/* 🔥 Like */}
      <button
        onClick={handleLike}
        disabled={!user}
        style={{
          display: 'flex', alignItems: 'center', gap: 3,
          padding: '4px 8px', borderRadius: 6,
          border: 'none',
          background: liked ? 'rgba(255,106,0,0.15)' : 'transparent',
          color: liked ? 'var(--orange)' : 'var(--gray-500)',
          fontFamily: 'var(--font-mono)', fontSize: 13,
          cursor: user ? 'pointer' : 'default',
          fontWeight: liked ? 700 : 400,
          transition: 'all 0.15s',
        }}
      >
        🔥{likeCount > 0 ? ` ${likeCount}` : ''}
      </button>

      {/* ❤️ Save */}
      <button
        onClick={handleFav}
        style={{
          padding: '4px 6px', borderRadius: 6,
          border: 'none', background: 'transparent',
          fontSize: 18, cursor: 'pointer',
          transition: 'transform 0.2s',
          transform: faved ? 'scale(1.15)' : 'scale(1)',
        }}
      >
        {faved ? '❤️' : '🤍'}
      </button>
    </div>
  );
}
