'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@/hooks/useUser';
import { useFavorites } from '@/hooks/useFavorites';
import { useToast } from './Toast';
import MapIcon from './MapIcon';
import { useLanguage } from './LanguageProvider';

interface Props {
  spotId: string;
  initialLikes: number;
}

export default function SpotPageActions({ spotId, initialLikes }: Props) {
  const user = useUser();
  const { isFav, toggleFav, loaded, pendingIds, error: favoriteError } = useFavorites();
  const {text} = useLanguage();
  const identity = useRef(user?.id); identity.current = user?.id;
  const { toast } = useToast();

  // 🔥 Likes
  const likeVersion = useRef(0);
  const [likeCount, setLikeCount] = useState(initialLikes);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLiked(false);
    const version = ++likeVersion.current;
    const headers: Record<string,string> = {};
    if (user) headers.Authorization = `Bearer ${user.accessToken}`;
    fetch(`/api/spot-likes?spot_id=${spotId}`, {headers, signal:controller.signal})
      .then(response => response.json()).then(result => { if (result.ok && !controller.signal.aborted && version === likeVersion.current) {setLikeCount(result.count);setLiked(result.hasLiked);} }).catch(() => {});
    return () => controller.abort();
  }, [spotId, user]);

  const handleLike = async () => {
    if (!user || likeLoading) { if (!user) toast(text('Accedi per votare', 'Sign in to vote'), 'info'); return; }
    setLikeLoading(true);
    ++likeVersion.current;
    const actor = user.id;
    try {
      const res = await fetch('/api/spot-likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` },
        body: JSON.stringify({ spot_id: spotId }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error();
      if (identity.current === actor) { setLiked(j.hasLiked); setLikeCount(j.count); }
    } catch { toast(text('Voto non salvato. Riprova.', 'Vote not saved. Try again.'), 'error'); }
    finally { setLikeLoading(false); }
  };

  const handleFav = () => { if (loaded) toggleFav(spotId); };
  const faved = isFav(spotId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {favoriteError && <p role="alert" style={{fontSize:14}}>{text('Preferiti non sincronizzati. Riprova dalla pagina Preferiti.', 'Favorites are not synced. Try again from Favorites.')}</p>}
      {/* Top row: 🔥 + ❤️ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button aria-label={text("Mi piace","Like")} disabled={likeLoading} aria-pressed={liked} onClick={handleLike}
          style={{
            display: 'flex', alignItems: 'center', gap: 3,
            minHeight: 44, minWidth: 44, padding: '4px 8px', borderRadius: 6, border: 'none',
            background: liked ? 'rgba(255,106,0,0.15)' : 'transparent',
            color: liked ? 'var(--orange)' : 'var(--gray-500)',
            fontFamily: 'var(--font-mono)', fontSize: 13,
            cursor: 'pointer', fontWeight: liked ? 700 : 400,
            transition: 'all 0.15s',
          }}>
          <MapIcon name="like" size={18} />{likeCount > 0 ? ` ${likeCount}` : ''}
        </button>
        <button disabled={!loaded || pendingIds.has(spotId)} aria-label={faved ? text("Rimuovi dai preferiti","Remove from favorites") : text("Aggiungi ai preferiti","Save to favorites")} aria-pressed={faved} onClick={handleFav}
          style={{
            minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 6px', borderRadius: 6,
            border: 'none', background: 'transparent',
            fontSize: 18, cursor: 'pointer',
            transition: 'transform 0.2s',
            transform: faved ? 'scale(1.15)' : 'scale(1)',
          }}>
          <MapIcon name="heart" filled={faved} />
        </button>
      </div>
    </div>
  );
}

/** Standalone star rating component for spot detail page body */
export function SpotStarRating({ spotId }: { spotId: string }) {
  const {text} = useLanguage();
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
    if (!user) { toast(text('Accedi per votare', 'Sign in to vote'), 'info'); return; }
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
          <button key={star} aria-label={text(`Vota ${star} ${star === 1 ? 'stella' : 'stelle'}`, `Rate ${star} ${star === 1 ? 'star' : 'stars'}`)} aria-pressed={myRating === star}
            onClick={() => handleStar(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            style={{
              background: 'none', border: 'none', padding: '2px', minHeight: 44, minWidth: 32,
              cursor: 'pointer', fontSize: 22, lineHeight: 1,
              color: star <= display ? '#ffce4d' : 'var(--gray-600)',
              transition: 'color 0.1s, transform 0.1s',
              transform: star === hover ? 'scale(1.2)' : 'scale(1)',
            }}>
            ★
          </button>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)' }}>
        {count > 0 ? `${avgRating.toFixed(1)} · ${count} ${text('voti','votes')}` : text('Vota questo spot','Rate this spot')}
      </div>
    </div>
  );
}
