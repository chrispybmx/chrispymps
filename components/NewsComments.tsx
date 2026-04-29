'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@/hooks/useUser';
import { useToast } from './Toast';

interface Comment {
  id: string;
  username: string;
  text: string;
  created_at: string;
  parent_id?: string | null;
  likes_count: number;
}

interface Props {
  newsId: string;
  newsSlug: string;
}

export default function NewsComments({ newsId, newsSlug }: Props) {
  const user = useUser();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load comments
  useEffect(() => {
    fetch(`/api/comments/${newsSlug}?type=news`)
      .then(r => r.json())
      .then(j => { if (j.ok) setComments(j.data ?? []); })
      .finally(() => setLoading(false));
  }, [newsSlug]);

  const handleSend = async () => {
    if (!user || !text.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/comments/${newsSlug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({ text: text.trim(), news_id: newsId }),
      });
      const j = await res.json();
      if (j.ok) {
        setComments(prev => [j.data, ...prev]);
        setText('');
        toast('Commento pubblicato', 'success');
      } else {
        toast(j.error || 'Errore', 'error');
      }
    } catch {
      toast('Errore di rete', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--gray-700)', paddingTop: 24, marginTop: 32 }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--orange)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16,
      }}>
        💬 Commenti ({comments.length})
      </div>

      {/* Write comment */}
      {user ? (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: 'var(--orange)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 14, color: '#000', flexShrink: 0,
          }}>
            {user.username[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Scrivi un commento..."
              maxLength={500}
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--gray-800)', border: '1px solid var(--gray-700)',
                borderRadius: 8, color: 'var(--bone)', fontFamily: 'var(--font-mono)',
                fontSize: 14, padding: '10px 12px', outline: 'none', resize: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <button
                onClick={handleSend}
                disabled={!text.trim() || sending}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  padding: '6px 16px', border: 'none', borderRadius: 4,
                  background: text.trim() ? 'var(--orange)' : 'var(--gray-700)',
                  color: text.trim() ? '#000' : 'var(--gray-500)',
                  cursor: text.trim() ? 'pointer' : 'default',
                  fontWeight: 700,
                }}
              >
                {sending ? '...' : 'INVIA'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-500)',
          padding: '16px', textAlign: 'center',
          background: 'var(--gray-800)', borderRadius: 8, marginBottom: 20,
        }}>
          🔑 Accedi per commentare
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-500)', textAlign: 'center', padding: '20px 0' }}>
          Caricamento...
        </div>
      ) : comments.length === 0 ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-500)', textAlign: 'center', padding: '20px 0' }}>
          Nessun commento ancora. Sii il primo!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {comments.map(c => (
            <div key={c.id} style={{
              display: 'flex', gap: 10, padding: '10px 0',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: 'var(--gray-700)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)', flexShrink: 0,
              }}>
                {c.username[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orange)' }}>@{c.username}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)' }}>
                    {new Date(c.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', lineHeight: 1.5 }}>
                  {c.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
