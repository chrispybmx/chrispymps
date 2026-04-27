'use client';

import { useState, useEffect, useRef } from 'react';

interface Comment {
  id:          string;
  username:    string;
  text:        string;
  created_at:  string;
  parent_id:   string | null;
  likes_count: number;
}

interface Props { spotId: string; spotSlug: string; }

export default function SpotInteractions({ spotId, spotSlug }: Props) {
  const [comments,    setComments]   = useState<Comment[]>([]);
  const [commLoading, setCommLoad]   = useState(true);
  const [posting,     setPosting]    = useState(false);
  const [postError,   setPostError]  = useState('');
  const [commentText, setCommentTxt] = useState('');
  const [token,       setToken]      = useState<string | null>(null);
  const [username,    setUsername]   = useState<string | null>(null);
  /* Set di comment_id che l'utente ha già likata */
  const [myLikes,     setMyLikes]    = useState<Set<string>>(new Set());
  /* Quale commento sta ricevendo una risposta */
  const [replyTo,     setReplyTo]    = useState<{ id: string; username: string } | null>(null);
  const [replyText,   setReplyText]  = useState('');
  const [replyPosting,setReplyPost]  = useState(false);
  const [replyError,  setReplyErr]   = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    import('@/lib/supabase-browser').then(({ supabaseBrowser }) => {
      supabaseBrowser().auth.getSession().then(({ data }) => {
        const t = data.session?.access_token ?? null;
        setToken(t);
        setUsername(
          data.session?.user?.user_metadata?.username ??
          data.session?.user?.email?.split('@')[0] ?? null
        );
      });
    }).catch(() => {});
  }, []);

  /* Carica commenti — passa il token per avere i propri like */
  useEffect(() => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`/api/comments/${spotSlug}`, { headers })
      .then(r => r.json())
      .then(j => {
        if (j.ok) {
          setComments(j.data);
          setMyLikes(new Set(j.myLikes ?? []));
        }
      })
      .catch(() => {})
      .finally(() => setCommLoad(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotSlug, token]);

  /* ── Like toggle ── */
  const handleLike = async (commentId: string) => {
    if (!token) return;
    // Ottimistico
    const wasLiked = myLikes.has(commentId);
    setMyLikes(prev => {
      const next = new Set(prev);
      wasLiked ? next.delete(commentId) : next.add(commentId);
      return next;
    });
    setComments(prev => prev.map(c =>
      c.id === commentId
        ? { ...c, likes_count: wasLiked ? Math.max(0, c.likes_count - 1) : c.likes_count + 1 }
        : c
    ));

    try {
      const res = await fetch('/api/comment-likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ comment_id: commentId }),
      });
      const j = await res.json();
      if (j.ok) {
        // Aggiorna con il valore reale dal server
        setComments(prev => prev.map(c =>
          c.id === commentId ? { ...c, likes_count: j.likes_count } : c
        ));
        setMyLikes(prev => {
          const next = new Set(prev);
          j.liked ? next.add(commentId) : next.delete(commentId);
          return next;
        });
      }
    } catch {
      // Rollback ottimistico
      setMyLikes(prev => {
        const next = new Set(prev);
        wasLiked ? next.add(commentId) : next.delete(commentId);
        return next;
      });
    }
  };

  /* ── Pubblica commento principale ── */
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
    } catch { setPostError('Errore di rete.'); }
    finally { setPosting(false); }
  };

  /* ── Pubblica risposta ── */
  const handleSubmitReply = async () => {
    if (!token || !replyTo) return;
    const text = replyText.trim();
    if (text.length < 2) { setReplyErr('Scrivi almeno 2 caratteri.'); return; }
    setReplyPost(true); setReplyErr('');
    try {
      const res = await fetch(`/api/comments/${spotSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text, parent_id: replyTo.id }),
      });
      const j = await res.json();
      if (j.ok) {
        setComments(prev => [...prev, j.data]);
        setReplyText(''); setReplyTo(null);
      } else { setReplyErr(j.error ?? 'Errore.'); }
    } catch { setReplyErr('Errore di rete.'); }
    finally { setReplyPost(false); }
  };

  /* ── Struttura: raggruppa risposte sotto il padre ── */
  const roots   = comments.filter(c => !c.parent_id);
  const replies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

  return (
    <div style={{ padding: '0 20px' }}>

      {/* Titolo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--gray-700)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          commenti {comments.length > 0 ? `(${comments.length})` : ''}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--gray-700)' }} />
      </div>

      {/* Lista */}
      {commLoading ? (
        <div style={{ color: 'var(--gray-500)', fontSize: 13, fontFamily: 'var(--font-mono)', padding: '8px 0 16px' }}>Caricamento…</div>
      ) : roots.length === 0 ? (
        <div style={{ color: 'var(--gray-600)', fontSize: 13, fontFamily: 'var(--font-mono)', padding: '12px 0 16px', textAlign: 'center' }}>
          Nessun commento ancora — sii il primo!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {roots.map(c => (
            <div key={c.id}>
              <CommentBubble
                comment={c}
                liked={myLikes.has(c.id)}
                token={token}
                onLike={() => handleLike(c.id)}
                onReply={() => {
                  if (replyTo?.id === c.id) { setReplyTo(null); }
                  else { setReplyTo({ id: c.id, username: c.username }); setReplyText(''); }
                }}
                isReplyOpen={replyTo?.id === c.id}
              />

              {/* Risposte indentate */}
              {replies(c.id).length > 0 && (
                <div style={{ marginLeft: 20, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '2px solid rgba(255,106,0,0.2)', paddingLeft: 12 }}>
                  {replies(c.id).map(r => (
                    <CommentBubble
                      key={r.id}
                      comment={r}
                      liked={myLikes.has(r.id)}
                      token={token}
                      onLike={() => handleLike(r.id)}
                      onReply={null} // non si risponde a una risposta
                      isReplyOpen={false}
                      isReply
                    />
                  ))}
                </div>
              )}

              {/* Box risposta inline */}
              {replyTo?.id === c.id && token && (
                <div style={{
                  marginLeft: 20, marginTop: 8,
                  borderLeft: '2px solid rgba(255,106,0,0.4)', paddingLeft: 12,
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', marginBottom: 6 }}>
                    ↩ Rispondi a <span style={{ color: 'var(--orange)' }}>@{replyTo.username}</span>
                  </div>
                  <textarea
                    autoFocus
                    value={replyText}
                    onChange={e => { setReplyText(e.target.value); setReplyErr(''); }}
                    placeholder={`Rispondi a @${replyTo.username}…`}
                    maxLength={500} rows={2}
                    style={{
                      width: '100%', background: '#0a0a0a', border: '1px solid var(--orange)',
                      borderRadius: 6, color: 'var(--bone)', fontSize: 13,
                      padding: '8px 10px', fontFamily: 'inherit', resize: 'none',
                      boxSizing: 'border-box', outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: replyError ? '#e05555' : 'var(--gray-500)', fontFamily: 'var(--font-mono)' }}>
                      {replyError || `${replyText.length}/500`}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => { setReplyTo(null); setReplyText(''); }}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)', background: 'none', border: '1px solid var(--gray-600)', borderRadius: 4, padding: '5px 10px', cursor: 'pointer' }}
                      >Annulla</button>
                      <button
                        onClick={handleSubmitReply}
                        disabled={replyPosting || replyText.trim().length < 2}
                        style={{
                          background: (replyPosting || replyText.trim().length < 2) ? 'var(--gray-700)' : 'var(--orange)',
                          color:      (replyPosting || replyText.trim().length < 2) ? 'var(--gray-500)' : '#000',
                          border: 'none', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11,
                          padding: '5px 12px', cursor: 'pointer', textTransform: 'uppercase',
                        }}
                      >{replyPosting ? '…' : 'Invia ↩'}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Box commenta principale */}
      {token ? (
        <div style={{ background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 10, padding: '12px 14px', marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', marginBottom: 8 }}>
            Commenta come <span style={{ color: 'var(--orange)' }}>@{username}</span>
          </div>
          <textarea
            ref={textareaRef}
            value={commentText}
            onChange={e => { setCommentTxt(e.target.value); setPostError(''); }}
            placeholder="Lascia un commento su questo spot…"
            maxLength={500} rows={3}
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
            >{posting ? 'Invio…' : 'Pubblica →'}</button>
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 10, padding: '16px 14px', textAlign: 'center', marginBottom: 24 }}>
          <p style={{ color: 'var(--gray-400)', fontSize: 14, marginBottom: 12 }}>
            Accedi per commentare o mettere like
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

/* ── Singolo commento ── */
function CommentBubble({
  comment, liked, token, onLike, onReply, isReplyOpen, isReply = false,
}: {
  comment:     Comment;
  liked:       boolean;
  token:       string | null;
  onLike:      () => void;
  onReply:     (() => void) | null;
  isReplyOpen: boolean;
  isReply?:    boolean;
}) {
  const dateStr = new Date(comment.created_at).toLocaleDateString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div style={{
      background: isReply ? 'rgba(255,106,0,0.04)' : 'var(--gray-800)',
      border: `1px solid ${isReply ? 'rgba(255,106,0,0.15)' : 'var(--gray-700)'}`,
      borderRadius: 10, padding: '10px 14px',
    }}>
      {/* Header: username + data */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <a
          href={`/u/${comment.username}`}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)', textDecoration: 'none' }}
        >
          @{comment.username}
        </a>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)' }}>{dateStr}</span>
      </div>

      {/* Testo */}
      <p style={{ color: 'var(--bone)', fontSize: 14, lineHeight: 1.5, margin: '0 0 10px' }}>
        {comment.text}
      </p>

      {/* Azioni: like + rispondi */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {/* Like */}
        <button
          onClick={token ? onLike : undefined}
          disabled={!token}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: liked ? 'rgba(255,59,92,0.12)' : 'transparent',
            border: liked ? '1px solid rgba(255,59,92,0.3)' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20, padding: '3px 9px',
            cursor: token ? 'pointer' : 'default',
            transition: 'background 0.15s, border-color 0.15s',
          }}
        >
          <span style={{ fontSize: 13 }}>{liked ? '❤️' : '🤍'}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: liked ? '#ff3b5c' : 'var(--gray-500)' }}>
            {comment.likes_count > 0 ? comment.likes_count : ''}
          </span>
        </button>

        {/* Rispondi — solo su commenti radice, solo se loggato */}
        {onReply && token && (
          <button
            onClick={onReply}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: isReplyOpen ? 'rgba(255,106,0,0.1)' : 'transparent',
              border: isReplyOpen ? '1px solid rgba(255,106,0,0.4)' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: '3px 9px',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
          >
            <span style={{ fontSize: 12 }}>↩</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: isReplyOpen ? 'var(--orange)' : 'var(--gray-500)' }}>
              Rispondi
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
