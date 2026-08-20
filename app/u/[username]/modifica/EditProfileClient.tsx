'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

interface Profile {
  id:                string;
  username:          string;
  bio?:              string | null;
  instagram_handle?: string | null;
  avatar_url?:       string | null;
}

interface Props { profile: Profile }

/**
 * Pagina di modifica profilo.
 *
 * Prima la modifica era un pannello che si apriva dentro la pagina profilo, e
 * la cancellazione dell'account stava in fondo alla stessa pagina: su un
 * profilo corto finiva comunque a vista. Un'azione irreversibile non deve
 * stare nella schermata che guardi ogni giorno.
 *
 * Qui la cancellazione resta raggiungibile — è un diritto dell'utente e la
 * privacy policy la promette — ma sta in fondo, dietro una riga di testo, e
 * chiede di scrivere il proprio nome utente prima di attivarsi.
 */
export default function EditProfileClient({ profile }: Props) {
  const router = useRouter();

  const [checking,  setChecking]  = useState(true);
  const [isOwn,     setIsOwn]     = useState(false);
  const [token,     setToken]     = useState<string | null>(null);

  const [bio,       setBio]       = useState(profile.bio ?? '');
  const [insta,     setInsta]     = useState(profile.instagram_handle ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState('');

  const [zonaAperta, setZonaAperta] = useState(false);
  const [conferma,   setConferma]   = useState('');
  const [deleting,   setDeleting]   = useState(false);

  useEffect(() => {
    supabaseBrowser().auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setToken(data.session?.access_token ?? null);
      if (u) {
        const uname = u.user_metadata?.username ?? u.email?.split('@')[0];
        setIsOwn(uname === profile.username);
      }
      setChecking(false);
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
        await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ avatar_url: j.url }),
        });
        setMsg('✅ Foto aggiornata');
        setTimeout(() => setMsg(''), 3000);
      }
    } catch { /* silenzioso: l'utente riprova */ }
    finally { setUploadingAvatar(false); }
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          bio: bio.trim() || null,
          instagram_handle: insta.replace('@', '').trim() || null,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setMsg('✅ Profilo aggiornato');
        setTimeout(() => router.push(`/u/${profile.username}`), 700);
      } else {
        setMsg('❌ ' + (j.error ?? 'Errore'));
        setTimeout(() => setMsg(''), 3000);
      }
    } catch {
      setMsg('❌ Errore di rete');
      setTimeout(() => setMsg(''), 3000);
    } finally { setSaving(false); }
  };

  const handleDeleteAccount = async () => {
    if (!token || conferma.trim() !== profile.username) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/user/delete', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (j.ok) {
        await supabaseBrowser().auth.signOut();
        router.push('/map');
      } else {
        setMsg('❌ ' + (j.error ?? 'Impossibile eliminare l\'account'));
        setDeleting(false);
      }
    } catch {
      setMsg('❌ Errore di rete. Riprova più tardi.');
      setDeleting(false);
    }
  };

  if (checking) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-500)' }}>
        Carico…
      </div>
    );
  }

  if (!isOwn) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 14, color: 'var(--bone)', marginBottom: 8 }}>
          Questo profilo non è tuo
        </div>
        <a href={`/u/${profile.username}`} style={{ fontSize: 12, color: 'var(--orange)' }}>
          ← Torna al profilo
        </a>
      </div>
    );
  }

  const label: React.CSSProperties = {
    display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11,
    color: 'var(--gray-400)', textTransform: 'uppercase',
    letterSpacing: '0.05em', marginBottom: 6,
  };
  const field: React.CSSProperties = {
    width: '100%', background: 'var(--gray-700)',
    border: '1px solid var(--gray-600)', borderRadius: 4,
    color: 'var(--bone)', fontSize: 14, padding: '10px',
    fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
  };

  return (
    <div style={{ padding: '20px' }}>

      {/* ── Foto ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div
          onClick={() => { if (!uploadingAvatar) avatarInputRef.current?.click(); }}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: avatarUrl ? 'transparent' : 'var(--orange)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 32, color: '#000',
            flexShrink: 0, border: '3px solid var(--gray-700)',
            overflow: 'hidden', cursor: 'pointer',
            opacity: uploadingAvatar ? 0.5 : 1,
          }}
        >
          {avatarUrl
            ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : profile.username[0].toUpperCase()}
        </div>
        <div>
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'var(--bone)', background: 'none',
              border: '1px solid var(--gray-600)', borderRadius: 4,
              padding: '7px 12px', cursor: uploadingAvatar ? 'default' : 'pointer',
            }}
          >
            {uploadingAvatar ? 'Caricamento…' : '📷 Cambia foto'}
          </button>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)', marginTop: 6 }}>
            JPG, PNG o WebP · max 5MB
          </div>
        </div>
      </div>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ''; }}
      />

      {/* ── Bio ── */}
      <div style={{ marginBottom: 18 }}>
        <label style={label} htmlFor="bio">Bio</label>
        <textarea
          id="bio"
          value={bio}
          onChange={e => setBio(e.target.value)}
          maxLength={200}
          rows={3}
          placeholder="Rider di BMX da… street, trail, park…"
          style={{ ...field, resize: 'vertical' }}
        />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)', marginTop: 4, textAlign: 'right' }}>
          {bio.length}/200
        </div>
      </div>

      {/* ── Instagram ── */}
      <div style={{ marginBottom: 24 }}>
        <label style={label} htmlFor="insta">Instagram</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--gray-400)' }}>@</span>
          <input
            id="insta"
            type="text"
            value={insta.replace('@', '')}
            onChange={e => setInsta(e.target.value)}
            placeholder="chrispy_bmx"
            maxLength={60}
            style={field}
          />
        </div>
      </div>

      {msg && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 12,
          color: msg.startsWith('✅') ? '#00c851' : '#ff4444',
        }}>
          {msg}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%', fontFamily: 'var(--font-mono)', fontSize: 14,
          padding: '13px', border: 'none', borderRadius: 8,
          background: saving ? 'var(--gray-700)' : 'var(--orange)',
          color: saving ? 'var(--gray-400)' : '#000',
          cursor: saving ? 'default' : 'pointer', fontWeight: 700,
          letterSpacing: '0.04em',
        }}
      >
        {saving ? 'Salvataggio…' : '💾 SALVA'}
      </button>

      {/* ══ Zona pericolosa — in fondo, silenziosa ══ */}
      <div style={{ marginTop: 72, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {!zonaAperta ? (
          <button
            onClick={() => setZonaAperta(true)}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--gray-700)', background: 'none',
              border: 'none', padding: 0, cursor: 'pointer',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--gray-500)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--gray-700)'; }}
          >
            Elimina account
          </button>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'var(--gray-400)', lineHeight: 1.7,
            }}>
              Cancelliamo il tuo profilo e i tuoi dati personali.
              Gli spot che hai pubblicato restano sulla mappa come contributi
              anonimi della community, così chi ci gira non li perde.
              <br />
              <span style={{ color: '#ff6b6b' }}>Non si torna indietro.</span>
            </div>

            <div>
              <label style={label} htmlFor="conferma">
                Scrivi <span style={{ color: 'var(--bone)' }}>{profile.username}</span> per confermare
              </label>
              <input
                id="conferma"
                type="text"
                value={conferma}
                onChange={e => setConferma(e.target.value)}
                autoComplete="off"
                style={field}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setZonaAperta(false); setConferma(''); }}
                style={{
                  flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13,
                  padding: '10px', background: 'transparent',
                  border: '1px solid var(--gray-600)', borderRadius: 6,
                  color: 'var(--gray-400)', cursor: 'pointer',
                }}
              >
                Lascia stare
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || conferma.trim() !== profile.username}
                style={{
                  flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13,
                  padding: '10px', borderRadius: 6,
                  background: 'transparent',
                  border: '1px solid rgba(255,77,77,0.5)',
                  color: '#ff6b6b',
                  cursor: (deleting || conferma.trim() !== profile.username) ? 'default' : 'pointer',
                  opacity: (deleting || conferma.trim() !== profile.username) ? 0.35 : 1,
                }}
              >
                {deleting ? 'Eliminazione…' : 'Elimina definitivamente'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
