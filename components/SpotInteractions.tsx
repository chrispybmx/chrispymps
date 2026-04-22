'use client';

import { useState, useEffect, useRef } from 'react';

/* ── localStorage utils ── */
const FAVS_KEY  = 'cmaps_favs_v1';
const ratingKey = (id: string) => `cmaps_rating_${id}`;

function isFav(id: string): boolean {
  try { return (JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]') as string[]).includes(id); }
  catch { return false; }
}
function toggleFav(id: string): boolean {
  try {
    const favs: string[] = JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]');
    const i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.push(id);
    localStorage.setItem(FAVS_KEY, JSON.stringify(favs));
    return i < 0;
  } catch { return false; }
}
function getMyRating(id: string): number {
  try { return Math.min(5, Math.max(0, parseInt(localStorage.getItem(ratingKey(id)) ?? '0', 10) || 0)); }
  catch { return 0; }
}
function saveRating(id: string, r: number): void {
  try { localStorage.setItem(ratingKey(id), String(r)); } catch {}
}

/* ── Types ── */
interface Comment {
  id: string;
  username: string;
  text: string;
  created_at: string;
}

interface Props {
  spotId:   string;
  spotSlug: string;
}

export default function SpotInteractions({ spotId, spotSlug }: Props) {
  const [myRating,   setMyRating]   = useState(0);
  const [hoverStar,  setHoverStar]  = useState(0);
  const [isFaved,    setIsFaved]    = useState(false);
  const [comments,   setComments]   = useState<Comment[]>([]);
  const [commLoading, setCommLoading] = useState(true);
  const [posting,    setPosting]    = useState(false);
  const [postError,  setPostError]  = useState('');
  const [commentText, setCommentText] = useState('');
  const [token,      setToken]      = useState<string | null>(null);
  const [username,   setUsername]   = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── Hydrate from localStorage ── */
  useEffect(() => {
    setMyRating(getMyRating(spotId));
    setIsFaved(isFav(spotId));
  }, [spotId]);

  /* ── Fetch auth token ── */
  useEffect(() => {
    import('@/lib/supabase-browser').then(({ supabaseBrowser }) => {
      const sb = supabaseBrowser();
      sb.auth.getSession().then(({ data }) => {
        const t = data.session?.access_token ?? null;
        setToken(t);
        const u = data.session?.user?.user_metadata?.username as string
          ?? data.session?.user?.email?.split('@')[0]
          ?? null;
        setUsername(u);
      });
    }).catch(() => {});
  }, []);

  /* ── Load comments ── */
  useEffect(() => {
    fetch(`/api/comments/${spotSlug}`)
      .then(r => r.json())
      .then(j => { if (j.ok) setComments(j.data); })
      .catch(() => {})
      .finally(() => setCommLoading(false));
  }, [spotSlug]);

  /* ── Handlers ── */
  const handleStar = (star: number) => {
    const next = star === myRating ? 0 : star;
    saveRating(spotId, next);
    setMyRating(next);
  };

  const handleFav = () => {
    const added = toggleFav(spotId);
    setIsFaved(added);
  };

  const handleSubmitComment = async () => {
    if (!token) return;
    const text = commentText.trim();
    if (text.length < 2) { setPostError('Scrivi almeno 2 caratteri.'); return; }
    if (text.length > 500) { setPostError('Massimo 500 caratteri.'); return; }
    setPosting(true); setPostError('');
    try {
      const res = await fetch(`/api/comments/${spotSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      const j = await res.json();
      if (j.ok) {
        setComments(prev => [...prev, j.data]);
        setCommentText('');
      } else {
        setPostError(j.error ?? 'Errore invio commento.');
      }
    } catch {
      setPostError('Errore di rete.');
    } finally {
      setPosting(false);
    }
  };

  const displayStars = hoverStar || myRating;

  return (
    <div>
      {/* ── Rating + Favoriti ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '18px 20px',
        borderTop: '1px solid var(--gray-700)',
        borderBottom: '1px solid var(--gray-700)',
        marginBottom: 0,
      }}>
        {/* Stars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {myRating > 0 ? `Il tuo voto: ${myRating}/5` : 'Dai un voto'}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {[1,2,3,4,5].map(star => (
              <button
                key={star}
                onMouseEnter={() => setHoverStar(star)}
                onMouseLeave={() => setHoverStar(0)}
                onClick={() => handleStar(star)}
                style={{
                  background: 'none', border: 'none', padding: '2px 1px',
                  cursor: 'pointer', fontSize: 22, lineHeight: 1,
                  color: star <= displayStars ? '#ffce4d' : 'var(--gray-600)',
                  transition: 'color 0.1s, transform 0.1s',
                  transform: star === hoverStar ? 'scale(1.2)' : 'scale(1)',
                }}
                aria-label={`${star} stelle`}
              >★</button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 36, background: 'var(--gray-700)' }} />

        {/* Favorites */}
        <button
          onClick={handleFav}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: 0,
          }}
        >
          <div style={{ fontSize: 26, lineHeight: 1, transition: 'transform 0.2s', transform: isFaved ? 'scale(1.15)' : 'scale(1)' }}>
            {isFaved ? '❤️' : '🤍'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase' }}>
            {isFaved ? 'Salvato' : 'Salva'}
          </div>
        </button>
      </div>

      {/* ── Commenti ── */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 12,
          color: 'var(--gray-400)', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 14,
        }}>
          COMMENTI {comments.length > 0 ? `(${comments.length})` : ''}
        </div>

        {/* Lista commenti */}
        {commLoading ? (
          <div style={{ color: 'var(--gray-500)', fontSize: 13, fontFamily: 'var(--font-mono)', padding: '8px 0' }}>
            Caricamento…
          </div>
        ) : comments.length === 0 ? (
          <div style={{
            color: 'var(--gray-600)', fontSize: 13, fontFamily: 'var(--font-mono)',
            padding: '16px 0', textAlign: 'center',
          }}>
            Nessun commento ancora — sii il primo!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {comments.map(c => (
              <div key={c.id} style={{
                background: 'var(--gray-800)',
                border: '1px solid var(--gray-700)',
                borderRadius: 6,
                padding: '10px 14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)', textTransform: 'uppercase' }}>
                    @{c.username}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)' }}>
                    {new Date(c.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <p style={{ color: 'var(--bone)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                  {c.text}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Form commento */}
        {token ? (
          <div style={{
            background: 'var(--gray-800)',
            border: '1px solid var(--gray-700)',
            borderRadius: 6, padding: '12px 14px',
            marginBottom: 24,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', marginBottom: 8 }}>
              Commenta come <span style={{ color: 'var(--orange)' }}>@{username}</span>
            </div>
            <textarea
              ref={textareaRef}
              value={commentText}
              onChange={e => { setCommentText(e.target.value); setPostError(''); }}
              placeholder="Lascia un commento su questo spot…"
              maxLength={500}
              rows={3}
              style={{
                width: '100%',
                background: 'var(--gray-900, #0a0a0a)',
                border: '1px solid var(--gray-600)',
                borderRadius: 4,
                color: 'var(--bone)',
                fontSize: 14,
                padding: '10px 12px',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box',
                outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--orange)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--gray-600)'; }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 11, color: postError ? '#e05555' : 'var(--gray-500)', fontFamily: 'var(--font-mono)' }}>
                {postError || `${commentText.length}/500`}
              </span>
              <button
                onClick={handleSubmitComment}
                disabled={posting || commentText.trim().length < 2}
                style={{
                  background: posting || commentText.trim().length < 2 ? 'var(--gray-700)' : 'var(--orange)',
                  color: posting || commentText.trim().length < 2 ? 'var(--gray-500)' : '#000',
                  border: 'none', borderRadius: 4,
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  padding: '8px 16px', cursor: posting || commentText.trim().length < 2 ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}
              >
                {posting ? 'Invio…' : 'Pubblica →'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            background: 'var(--gray-800)',
            border: '1px solid var(--gray-700)',
            borderRadius: 6, padding: '16px 14px',
            textAlign: 'center', marginBottom: 24,
          }}>
            <p style={{ color: 'var(--gray-400)', fontSize: 14, marginBottom: 12 }}>
              Accedi per lasciare un commento
            </p>
            <a
              href="/map"
              style={{
                display: 'inline-block',
                background: 'var(--orange)', color: '#000',
                fontFamily: 'var(--font-mono)', fontSize: 12,
                padding: '8px 20px', borderRadius: 4,
                textDecoration: 'none', textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Accedi / Registrati →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
