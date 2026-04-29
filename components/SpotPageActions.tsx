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

  // 🔥 Likes
  const [likeCount, setLikeCount] = useState(initialLikes);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  // ⭐ Stars
  const [myRating, setMyRating] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [ratingsCount, setRatingsCount] = useState(0);
  const [hoverStar, setHoverStar] = useState(0);

  useEffect(() => {
    if (!user) return;
    const headers = { Authorization: `Bearer ${user.accessToken}` };

    // Fetch likes
    fetch(`/api/spot-likes?spot_id=${spotId}`, { headers })
      .then(r => r.json())
      .then(j => { if (j.ok) { setLikeCount(j.count); setLiked(j.hasLiked); } })
      .catch(() => {});

    // Fetch ratings
    fetch(`/api/spot-ratings?spot_id=${spotId}`, { headers })
      .then(r => r.json())
      .then(j => { if (j.ok) { setMyRating(j.myRating); setAvgRating(j.avg); setRatingsCount(j.count); } })
      .catch(() => {});
  }, [spotId, user?.id]); // eslint-disable-line

  // Fetch public ratings even without auth
  useEffect(() => {
    if (user) return; // already fetched above
    fetch(`/api/spot-ratings?spot_id=${spotId}`)
      .then(r => r.json())
      .then(j => { if (j.ok) { setAvgRating(j.avg); setRatingsCount(j.count); } })
      .catch(() => {});
  }, [spotId, user]); // eslint-disable-line

  const handleLike = async () => {
    if (!user || likeLoading) { if (!user) toast('Accedi per votare', 'info'); return; }
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
    if (!user) { toast('Accedi per salvare', 'info'); return; }
    const added = toggleFav(spotId);
    toast(added ? 'Salvato nei preferiti' : 'Rimosso dai preferiti', added ? 'success' : 'info');
  };

  const handleStar = async (star: number) => {
    if (!user) { toast('Accedi per votare', 'info'); return; }
    const newRating = star === myRating ? 0 : star; // tap same star = remove
    setMyRating(newRating);
    try {
      const res = await fetch('/api/spot-ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` },
        body: JSON.stringify({ spot_id: spotId, rating: newRating }),
      });
      const j = await res.json();
      if (j.ok) { setMyRating(j.myRating); setAvgRating(j.avg); setRatingsCount(j.count); }
    } catch {}
  };

  const faved = isFav(spotId);
  const displayStars = hoverStar || myRating;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Top row: 🔥 + ❤️ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button onClick={handleLike}
          style={{
            display: 'flex', alignItems: 'center', gap: 3,
            padding: '4px 8px', borderRadius: 6, border: 'none',
            background: liked ? 'rgba(255,106,0,0.15)' : 'transparent',
            color: liked ? 'var(--orange)' : 'var(--gray-500)',
            fontFamily: 'var(--font-mono)', fontSize: 13,
            cursor: 'pointer', fontWeight: liked ? 700 : 400,
            transition: 'all 0.15s',
          }}>
          🔥{likeCount > 0 ? ` ${likeCount}` : ''}
        </button>
        <button onClick={handleFav}
          style={{
            padding: '4px 6px', borderRadius: 6,
            border: 'none', background: 'transparent',
            fontSize: 18, cursor: 'pointer',
            transition: 'transform 0.2s',
            transform: faved ? 'scale(1.15)' : 'scale(1)',
          }}>
          {faved ? '❤️' : '🤍'}
        </button>
      </div>
    </div>
  );
}

/** Standalone star rating component for spot detail page body */
export function SpotStarRating({ spotId }: { spotId: string }) {
  const user = useUser();
  const { toast } = useToast();
  const [myRating, setMyRating] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [count, setCount] = useState(0);
  const [hover, setHover] = useState(0);

  useEffect(() => {
    const headers: Record<string, string> = {};
    if (user) headers.Authorization = `Bearer ${user.accessToken}`;
    fetch(`/api/spot-ratings?spot_id=${spotId}`, { headers })
      .then(r => r.json())
      .then(j => { if (j.ok) { setMyRating(j.myRating); setAvgRating(j.avg); setCount(j.count); } })
      .catch(() => {});
  }, [spotId, user?.id]); // eslint-disable-line

  const handleStar = async (star: number) => {
    if (!user) { toast('Accedi per votare', 'info'); return; }
    const newR = star === myRating ? 0 : star;
    setMyRating(newR);
    try {
      const res = await fetch('/api/spot-ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` },
        body: JSON.stringify({ spot_id: spotId, rating: newR }),
      });
      const j = await res.json();
      if (j.ok) { setMyRating(j.myRating); setAvgRating(j.avg); setCount(j.count); }
    } catch {}
  };

  const display = hover || myRating;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', marginBottom: 16,
      background: 'var(--gray-800)', borderRadius: 8,
      border: '1px solid var(--gray-700)',
    }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star}
            onClick={() => handleStar(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            style={{
              background: 'none', border: 'none', padding: '2px',
              cursor: 'pointer', fontSize: 22, lineHeight: 1,
              color: star <= display ? '#ffce4d' : 'var(--gray-600)',
              transition: 'color 0.1s, transform 0.1s',
              transform: star === hover ? 'scale(1.2)' : 'scale(1)',
            }}>
            ★
          </button>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>
        {count > 0 ? `${avgRating.toFixed(1)} · ${count} voti` : 'Vota questo spot'}
      </div>
    </div>
  );
}
