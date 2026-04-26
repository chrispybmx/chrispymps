'use client';

import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';

interface Profile {
  id:               string;
  username:         string;
  bio?:             string | null;
  instagram_handle?: string | null;
}

interface Props {
  profile:  Profile;
  joinDate: string;
}

export default function ProfileClient({ profile, joinDate }: Props) {
  const [isOwn,    setIsOwn]    = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [bio,      setBio]      = useState(profile.bio ?? '');
  const [insta,    setInsta]    = useState(profile.instagram_handle ?? '');
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState('');
  const [token,    setToken]    = useState<string | null>(null);

  useEffect(() => {
    supabaseBrowser().auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      const t = data.session?.access_token ?? null;
      setToken(t);
      if (u) {
        const uname = u.user_metadata?.username ?? u.email?.split('@')[0];
        setIsOwn(uname === profile.username);
      }
    });
  }, [profile.username]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bio: bio.trim() || null, instagram_handle: insta.replace('@','').trim() || null }),
      });
      const j = await res.json();
      if (j.ok) { setMsg('✅ Profilo aggiornato!'); setEditing(false); }
      else { setMsg('❌ ' + (j.error ?? 'Errore')); }
    } catch { setMsg('❌ Errore di rete'); }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
  };

  const instaHandle = insta || profile.instagram_handle;

  return (
    <div style={{ padding: '28px 0 24px', borderBottom: '1px solid var(--gray-700)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
        {/* Avatar */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'var(--orange)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 32, color: '#000',
          flexShrink: 0, border: '3px solid var(--gray-700)',
        }}>
          {profile.username[0].toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 26, color: 'var(--bone)', margin: '0 0 4px' }}>
            @{profile.username}
          </h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginBottom: 8 }}>
            Community BMX · dal {joinDate}
          </div>

          {/* Bio */}
          {(profile.bio || bio) && !editing && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', margin: '0 0 8px', lineHeight: 1.5 }}>
              {bio || profile.bio}
            </p>
          )}

          {/* Instagram */}
          {instaHandle && !editing && (
            <a
              href={`https://instagram.com/${instaHandle.replace('@','')}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orange)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              📸 @{instaHandle.replace('@','')}
            </a>
          )}

          {/* Edit button + Preferiti (solo owner) */}
          {isOwn && !editing && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => setEditing(true)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', background: 'none', border: '1px solid var(--gray-600)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                ✏️ Modifica profilo
              </button>
              <a
                href="/preferiti"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff4d6d', background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.4)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                ❤️ Spot salvati
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div style={{ marginTop: 20, background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 8, padding: '16px' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Bio (max 200 caratteri)
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={200} rows={2}
              placeholder="Rider di BMX da... Street, trail, park..."
              style={{ width: '100%', background: 'var(--gray-700)', border: '1px solid var(--gray-600)', borderRadius: 4, color: 'var(--bone)', fontSize: 14, padding: '8px 10px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Instagram (solo username)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)' }}>@</span>
              <input
                type="text" value={insta.replace('@','')} onChange={e => setInsta(e.target.value)}
                placeholder="chrispybmx" maxLength={60}
                style={{ flex: 1, background: 'var(--gray-700)', border: '1px solid var(--gray-600)', borderRadius: 4, color: 'var(--bone)', fontSize: 14, padding: '8px 10px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          {msg && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: msg.startsWith('✅') ? '#00c851' : '#ff4444', marginBottom: 10 }}>{msg}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setEditing(false); setBio(profile.bio ?? ''); setInsta(profile.instagram_handle ?? ''); }}
              style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13, padding: '9px', background: 'transparent', border: '1px solid var(--gray-600)', borderRadius: 4, color: 'var(--gray-400)', cursor: 'pointer' }}>
              Annulla
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 2, fontFamily: 'var(--font-mono)', fontSize: 13, padding: '9px', background: saving ? 'var(--gray-700)' : 'var(--orange)', border: 'none', borderRadius: 4, color: saving ? 'var(--gray-400)' : '#000', cursor: saving ? 'default' : 'pointer', fontWeight: 700 }}>
              {saving ? '...' : '💾 Salva'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
