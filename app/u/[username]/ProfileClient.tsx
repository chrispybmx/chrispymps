'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

interface Profile {
  id:               string;
  username:         string;
  bio?:             string | null;
  instagram_handle?: string | null;
  avatar_url?:      string | null;
}

interface Props {
  profile:  Profile;
  joinDate: string;
}

export default function ProfileClient({ profile, joinDate }: Props) {
  const router = useRouter();
  const [isOwn,    setIsOwn]    = useState(false);
  const [bio]      = useState(profile.bio ?? '');
  const [insta]    = useState(profile.instagram_handle ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
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

  const handleAvatarUpload = async (file: File) => {
    if (!token || file.size > 5 * 1024 * 1024) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('access_token', token);
      fd.append('purpose', 'general');
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const j = await res.json();
      if (j.ok && j.url) {
        setAvatarUrl(j.url);
        // Save avatar URL to profile
        await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ avatar_url: j.url }),
        });
      }
    } catch {}
    finally { setUploadingAvatar(false); }
  };

  const instaHandle = insta || profile.instagram_handle;

  return (
    <div style={{ padding: '0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
        {/* Avatar — tap to change if owner */}
        <div
          onClick={() => { if (isOwn && !uploadingAvatar) avatarInputRef.current?.click(); }}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: avatarUrl ? 'transparent' : 'var(--orange)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 32, color: '#000',
            flexShrink: 0, border: '3px solid var(--gray-700)',
            overflow: 'hidden', cursor: isOwn ? 'pointer' : 'default',
            position: 'relative', opacity: uploadingAvatar ? 0.5 : 1,
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            profile.username[0].toUpperCase()
          )}
          {isOwn && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'rgba(0,0,0,0.6)', textAlign: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 8, color: '#fff',
              padding: '2px 0',
            }}>
              📷
            </div>
          )}
        </div>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ''; }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 26, color: 'var(--bone)', margin: '0 0 4px' }}>
            @{profile.username}
          </h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginBottom: 8 }}>
            Community BMX · dal {joinDate}
          </div>

          {/* Bio */}
          {(profile.bio || bio) && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', margin: '0 0 8px', lineHeight: 1.5 }}>
              {bio || profile.bio}
            </p>
          )}

          {/* Instagram */}
          {instaHandle && (
            <a
              href={`https://instagram.com/${instaHandle.replace('@','')}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orange)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              📸 @{instaHandle.replace('@','')}
            </a>
          )}

          {/* Edit button + Preferiti (solo owner) */}
          {isOwn && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <a
                href={`/u/${profile.username}/modifica`}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', background: 'none', border: '1px solid var(--gray-600)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                ✏️ Modifica profilo
              </a>
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

    </div>
  );
}
