'use client';

import { useState, useEffect, useRef } from 'react';

interface Comment { id: string; username: string; text: string; created_at: string; }
interface Props { spotId: string; spotSlug: string; }

export default function SpotInteractions({ spotId, spotSlug }: Props) {
  const [comments,    setComments]   = useState<Comment[]>([]);
  const [commLoading, setCommLoad]   = useState(true);
  const [posting,     setPosting]    = useState(false);
  const [postError,   setPostError]  = useState('');
  const [commentText, setCommentTxt] = useState('');
  const [token,       setToken]      = useState<string | null>(null);
  const [username,    setUsername]   = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    import('@/lib/supabase-browser').then(({ supabaseBrowser }) => {
      supabaseBrowser().auth.getSession().then(({ data }) => {
        const t = data.session?.access_token ?? null;
        setToken(t);
        setUsername(data.session?.user?.user_metadata?.username ?? data.session?.user?.email?.split('@')[0] ?? null);
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/comments/${spotSlug}`)
      .then(r => r.json()).then(j => { if (j.ok) setComments(j.data); })
      .catch(() => {}).finally(() => setCommLoad(false));
  }, [spotSlug]);

  const handleSubmitComment = async () => {
    if (!token) return;
    const text = commentText.trim();
    if (text.length < 2) { setPostError('Scrivi almeno 2 caratteri.'); return; }
    setPosting(true); setPostError('');
    try {
      const res = await fetch(`/api/comments/${spotSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      const j = await res.json();
      if (j.ok) { setComments(prev => [...prev, j.data]); setCommentTxt(''); }
      else { setPostError(j.error ?? 'Errore.'); }
    } catch { setPostError('Errore di rete.'); } finally { setPosting(false); }
  };

  return (
    <div style={{ padding: '0 20px' }}>

      {/* ── Titolo commenti ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
      }}>
        <div style={{ flex: 1, height: 1, background: 'var(--gray-700)' }} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          commenti {comments.length > 0 ? `(${comments.length})` : ''}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--gray-700)' }} />
      </div>

      {/* ── Lista ── */}
      {commLoading ? (
        <div style={{ color: 'var(--gray-500)', fontSize: 13, fontFamily: 'var(--font-mono)', padding: '8px 0 16px' }}>Caricamento…</div>
      ) : comments.length === 0 ? (
        <div style={{ color: 'var(--gray-600)', fontSize: 13, fontFamily: 'var(--font-mono)', padding: '12px 0 16px', textAlign: 'center' }}>
          Nessun commento ancora — sii il primo!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {comments.map(c => (
            <div key={c.id} style={{
              background: 'var(--gray-800)', border: '1px solid var(--gray-700)',
              borderRadius: 10, padding: '10px 14px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <a href={`/u/${c.username}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)', textDecoration: 'none' }}>
                  @{c.username}
                </a>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)' }}>
                  {new Date(c.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <p style={{ color: 'var(--bone)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>{c.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Box commenta / login ── */}
      {token ? (
        <div style={{
          background: 'var(--gray-800)', border: '1px solid var(--gray-700)',
          borderRadius: 10, padding: '12px 14px', marginBottom: 24,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', marginBottom: 8 }}>
            Commenta come <span style={{ color: 'var(--orange)' }}>@{username}</span>
          </div>
          <textarea
            ref={textareaRef}
            value={commentText}
            onChange={e => { setCommentTxt(e.target.value); setPostError(''); }}
            placeholder="Lascia un commento su questo spot…"
            maxLength={500}
            rows={3}
            style={{
              width: '100%', background: '#0a0a0a', border: '1px solid var(--gray-600)',
              borderRadius: 6, color: 'var(--bone)', fontSize: 14,
              padding: '10px 12px', fontFamily: 'inherit', resize: 'vertical',
              boxSizing: 'border-box', outline: 'none',
            }}
            onFocus={e  => { e.currentTarget.style.borderColor = 'var(--orange)'; }}
            onBlur={e   => { e.currentTarget.style.borderColor = 'var(--gray-600)'; }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: postError ? '#e05555' : 'var(--gray-500)', fontFamily: 'var(--font-mono)' }}>
              {postError || `${commentText.length}/500`}
            </span>
            <button
              onClick={handleSubmitComment}
              disabled={posting || commentText.trim().length < 2}
              style={{
                background: (posting || commentText.trim().length < 2) ? 'var(--gray-700)' : 'var(--orange)',
                color:      (posting || commentText.trim().length < 2) ? 'var(--gray-500)' : '#000',
                border: 'none', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12,
                padding: '8px 18px', cursor: (posting || commentText.trim().length < 2) ? 'default' : 'pointer',
                transition: 'background 0.15s', textTransform: 'uppercase', letterSpacing: '0.04em',
              }}
            >
              {posting ? 'Invio…' : 'Pubblica →'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          background: 'var(--gray-800)', border: '1px solid var(--gray-700)',
          borderRadius: 10, padding: '16px 14px', textAlign: 'center', marginBottom: 24,
        }}>
          <p style={{ color: 'var(--gray-400)', fontSize: 14, marginBottom: 12 }}>
            Accedi per commentare o segnare che hai girato qui
          </p>
          <a href="/" style={{
            display: 'inline-block', background: 'var(--orange)', color: '#000',
            fontFamily: 'var(--font-mono)', fontSize: 12, padding: '8px 20px',
            borderRadius: 6, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            Accedi / Registrati →
          </a>
        </div>
      )}
    </div>
  );
}
