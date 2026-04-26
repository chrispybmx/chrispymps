'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminCard from '@/components/AdminCard';
import AdminImportKML from '@/components/AdminImportKML';
import type { Spot, SpotType } from '@/lib/types';
import { TIPI_SPOT, CITTA_ITALIANE } from '@/lib/constants';

type Tab = 'pending' | 'all' | 'import' | 'stats' | 'events' | 'news' | 'comments' | 'users';

interface AdminComment {
  id: string;
  username: string;
  text: string;
  created_at: string;
  spot_id: string;
  spots?: { name: string; slug: string; city?: string } | null;
}

interface AdminUser {
  id:               string;
  username:         string;
  bio?:             string | null;
  instagram_handle?: string | null;
  created_at:       string;
  spot_count:       number;
  pending_spots:    number;
  comment_count:    number;
}

interface AdminDashboardProps {
  initialSpots: Spot[];
}

/* ─── Event / News types ─── */
interface AdminEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  city?: string;
  event_date: string;
  cover_url?: string;
  link_url?: string;
  status: string;
  spot_id?: string | null;
  spot?: { name: string; slug: string } | null;
}

interface SpotOption {
  id: string;
  name: string;
  slug: string;
  city?: string;
}

interface AdminNews {
  id: string;
  title: string;
  excerpt?: string;
  body?: string;
  cover_url?: string;
  tags?: string;
  status: string;
  published_at?: string;
  created_at: string;
}

const EMPTY_EVENT: Omit<AdminEvent, 'id'> = {
  title: '', description: '', location: '', city: '', event_date: '', cover_url: '', link_url: '', status: 'published', spot_id: null, spot: null,
};
const EMPTY_NEWS: Omit<AdminNews, 'id' | 'created_at'> = {
  title: '', excerpt: '', body: '', cover_url: '', tags: '', status: 'draft',
};

/* ─── Shared field style ─── */
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--gray-800)', border: '1px solid var(--gray-700)',
  borderRadius: 4, color: 'var(--bone)', fontFamily: 'var(--font-mono)',
  fontSize: 14, padding: '8px 10px',
};
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)',
  textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4,
};

export default function AdminDashboard({ initialSpots }: AdminDashboardProps) {
  const router = useRouter();
  const [tab, setTab]     = useState<Tab>('pending');
  const [pending,   setPending] = useState<Spot[]>(initialSpots);
  const [allSpots,  setAllSpots] = useState<Spot[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loading,   setLoading] = useState<string | null>(null);
  const [msg,       setMsg]     = useState<string | null>(null);
  const [filterType, setFilterType] = useState<SpotType | 'all'>('all');
  const [filterCity, setFilterCity] = useState('');

  /* ── Events state ── */
  const [events, setEvents]         = useState<AdminEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [editingEvent, setEditingEvent]   = useState<(Partial<AdminEvent> & { id?: string }) | null>(null);
  const [savingEvent, setSavingEvent]     = useState(false);

  /* ── News state ── */
  const [newsList, setNewsList]       = useState<AdminNews[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [editingNews, setEditingNews] = useState<(Partial<AdminNews> & { id?: string }) | null>(null);
  const [savingNews, setSavingNews]   = useState(false);

  /* ── Comments state ── */
  const [adminComments, setAdminComments] = useState<AdminComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  /* ── Users state ── */
  const [adminUsers, setAdminUsers]       = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers]   = useState(false);
  const [userSearch, setUserSearch]       = useState('');

  /* ── Load all spots ── */
  useEffect(() => {
    if (tab !== 'all' && tab !== 'stats') return;
    if (allSpots.length > 0) return;
    setLoadingAll(true);
    fetch('/api/admin/all-spots')
      .then(r => r.json())
      .then(j => { if (j.ok) setAllSpots(j.data); })
      .finally(() => setLoadingAll(false));
  }, [tab]);

  /* ── Load events ── */
  useEffect(() => {
    if (tab !== 'events') return;
    if (events.length > 0) return;
    setLoadingEvents(true);
    fetch('/api/admin/events')
      .then(r => r.json())
      .then(j => { if (j.ok) setEvents(j.data); })
      .finally(() => setLoadingEvents(false));
  }, [tab]);

  /* ── Load news ── */
  useEffect(() => {
    if (tab !== 'news') return;
    if (newsList.length > 0) return;
    setLoadingNews(true);
    fetch('/api/admin/news')
      .then(r => r.json())
      .then(j => { if (j.ok) setNewsList(j.data); })
      .finally(() => setLoadingNews(false));
  }, [tab]);

  /* ── Load comments ── */
  useEffect(() => {
    if (tab !== 'comments') return;
    setLoadingComments(true);
    fetch('/api/admin/comments')
      .then(r => r.json())
      .then(j => { if (j.ok) setAdminComments(j.data); })
      .finally(() => setLoadingComments(false));
  }, [tab]);

  /* ── Load users ── */
  useEffect(() => {
    if (tab !== 'users') return;
    if (adminUsers.length > 0) return;
    setLoadingUsers(true);
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(j => { if (j.ok) setAdminUsers(j.data); })
      .finally(() => setLoadingUsers(false));
  }, [tab]);

  /* ── User moderation actions ── */
  const handleDeleteUserComments = useCallback(async (username: string) => {
    if (!window.confirm(`Eliminare tutti i commenti di @${username}?`)) return;
    const res  = await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, action: 'delete_comments' }) });
    const json = await res.json();
    if (json.ok) {
      setAdminUsers(prev => prev.map(u => u.username === username ? { ...u, comment_count: 0 } : u));
      setAdminComments(prev => prev.filter(c => c.username !== username));
      showMsg(`🗑️ Commenti di @${username} eliminati.`);
    } else { showMsg('❌ ' + json.error); }
  }, []);

  const handleSuspendUser = useCallback(async (username: string) => {
    if (!window.confirm(`Sospendere @${username}?\n\nVerranno eliminati tutti i commenti e gli spot verranno rimessi in attesa di revisione.`)) return;
    const res  = await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, action: 'suspend' }) });
    const json = await res.json();
    if (json.ok) {
      setAdminUsers(prev => prev.map(u => u.username === username ? { ...u, comment_count: 0, pending_spots: u.spot_count } : u));
      setAdminComments(prev => prev.filter(c => c.username !== username));
      showMsg(`⛔ @${username} sospeso.`);
    } else { showMsg('❌ ' + json.error); }
  }, []);

  const handleDeleteComment = useCallback(async (comment: AdminComment) => {
    if (!window.confirm(`Eliminare il commento di @${comment.username}?\n\n"${comment.text.slice(0, 80)}${comment.text.length > 80 ? '…' : ''}"`)) return;
    const res  = await fetch('/api/admin/comments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_id: comment.id }),
    });
    const json = await res.json();
    if (json.ok) {
      setAdminComments(prev => prev.filter(c => c.id !== comment.id));
      showMsg('🗑️ Commento eliminato.');
    } else {
      showMsg('❌ ' + json.error);
    }
  }, []);

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000); };

  /* ── Refresh pending ── */
  const refreshPending = useCallback(() => {
    setLoadingPending(true);
    fetch('/api/admin/all-spots')
      .then(r => r.json())
      .then(j => {
        if (j.ok) setPending((j.data as Spot[]).filter(s => s.status === 'pending'));
      })
      .finally(() => setLoadingPending(false));
  }, []);

  /* ── Spot actions ── */
  const handleApprove = useCallback(async (id: string) => {
    setLoading(id);
    const res  = await fetch('/api/admin/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spot_id: id }) });
    const json = await res.json();
    if (json.ok) { setPending(s => s.filter(x => x.id !== id)); showMsg('✅ Spot approvato!'); }
    else         { showMsg('❌ ' + json.error); }
    setLoading(null);
  }, []);

  const handleReject = useCallback(async (id: string) => {
    const reason = window.prompt('Motivo del rifiuto (opzionale):');
    if (reason === null) return;
    setLoading(id);
    const res  = await fetch('/api/admin/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spot_id: id, reason: reason || undefined }) });
    const json = await res.json();
    if (json.ok) { setPending(s => s.filter(x => x.id !== id)); showMsg('🗑️ Spot rifiutato.'); }
    else         { showMsg('❌ ' + json.error); }
    setLoading(null);
  }, []);

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!window.confirm(`Eliminare definitivamente "${name}"?\nQuesta azione non può essere annullata.`)) return;
    setLoading(id);
    const res  = await fetch('/api/admin/delete-spot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spot_id: id }) });
    const json = await res.json();
    if (json.ok) {
      setAllSpots(s => s.filter(x => x.id !== id));
      setPending(s => s.filter(x => x.id !== id));
      showMsg('🗑️ Spot eliminato.');
    } else { showMsg('❌ ' + json.error); }
    setLoading(null);
  }, []);

  const handleEdit = useCallback((id: string) => router.push(`/admin/${id}`), [router]);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  /* ── Events CRUD ── */
  const saveEvent = async () => {
    if (!editingEvent?.title?.trim()) { showMsg('❌ Il titolo è obbligatorio'); return; }
    if (!editingEvent?.event_date)    { showMsg('❌ La data è obbligatoria'); return; }
    setSavingEvent(true);
    const res  = await fetch('/api/admin/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingEvent) });
    const json = await res.json();
    if (json.ok) {
      setEvents([]);   // force reload
      setEditingEvent(null);
      setLoadingEvents(true);
      fetch('/api/admin/events').then(r => r.json()).then(j => { if (j.ok) setEvents(j.data); }).finally(() => setLoadingEvents(false));
      showMsg(editingEvent.id ? '✅ Evento aggiornato!' : '✅ Evento creato!');
    } else { showMsg('❌ ' + json.error); }
    setSavingEvent(false);
  };

  const deleteEvent = async (id: string, title: string) => {
    if (!window.confirm(`Eliminare l'evento "${title}"?`)) return;
    const res  = await fetch('/api/admin/events', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    const json = await res.json();
    if (json.ok) { setEvents(s => s.filter(e => e.id !== id)); showMsg('🗑️ Evento eliminato.'); }
    else         { showMsg('❌ ' + json.error); }
  };

  /* ── News CRUD ── */
  const saveNews = async () => {
    if (!editingNews?.title?.trim()) { showMsg('❌ Il titolo è obbligatorio'); return; }
    setSavingNews(true);
    const res  = await fetch('/api/admin/news', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingNews) });
    const json = await res.json();
    if (json.ok) {
      setNewsList([]);
      setEditingNews(null);
      setLoadingNews(true);
      fetch('/api/admin/news').then(r => r.json()).then(j => { if (j.ok) setNewsList(j.data); }).finally(() => setLoadingNews(false));
      showMsg(editingNews.id ? '✅ Articolo aggiornato!' : '✅ Articolo creato!');
    } else { showMsg('❌ ' + json.error); }
    setSavingNews(false);
  };

  const deleteNews = async (id: string, title: string) => {
    if (!window.confirm(`Eliminare l'articolo "${title}"?`)) return;
    const res  = await fetch('/api/admin/news', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    const json = await res.json();
    if (json.ok) { setNewsList(s => s.filter(n => n.id !== id)); showMsg('🗑️ Articolo eliminato.'); }
    else         { showMsg('❌ ' + json.error); }
  };

  /* ── Filtri "Tutti" ── */
  const displayAll = allSpots.filter(s => {
    if (filterType !== 'all' && s.type !== filterType) return false;
    if (filterCity && s.city !== filterCity) return false;
    return true;
  });
  const uniqueCities = [...new Set(allSpots.map(s => s.city).filter(Boolean) as string[])].sort();

  /* ── Stats ── */
  const total  = allSpots.length;
  const byType = Object.entries(TIPI_SPOT).map(([type, info]) => ({
    type, info, count: allSpots.filter(s => s.type === type).length,
  })).sort((a, b) => b.count - a.count);
  const byCondition = {
    alive:    allSpots.filter(s => s.condition === 'alive').length,
    bustato:  allSpots.filter(s => s.condition === 'bustato').length,
    demolito: allSpots.filter(s => s.condition === 'demolito').length,
  };

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: 'pending',  label: '📥 In attesa', badge: pending.length },
    { key: 'all',      label: '🗺️ Spot' },
    { key: 'comments', label: '💬 Commenti' },
    { key: 'users',    label: '👤 Utenti' },
    { key: 'events',   label: '📅 Eventi' },
    { key: 'news',     label: '📰 News' },
    { key: 'import',   label: '📂 Importa' },
    { key: 'stats',    label: '📊 Stats' },
  ];

  return (
    <div style={{ background: 'var(--black)', minHeight: '100dvh', paddingBottom: 40 }}>

      {/* Header sticky */}
      <div style={{
        position: 'sticky', top: 0,
        background: 'rgba(10,10,10,0.97)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--gray-700)',
        zIndex: 30,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 0' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)' }}>
            🏴 CHRISPY MAPS — ADMIN
          </div>
          <button onClick={handleLogout} className="btn-ghost" style={{ fontSize: 13 }}>Logout</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', padding: '0 20px', gap: 2, marginTop: 10, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 12,
                padding: '8px 10px',
                border: `1px solid ${tab === t.key ? 'var(--orange)' : 'var(--gray-700)'}`,
                borderBottom: tab === t.key ? '1px solid var(--black)' : '1px solid var(--gray-700)',
                borderRadius: '4px 4px 0 0',
                background: tab === t.key ? 'var(--black)' : 'transparent',
                color: tab === t.key ? 'var(--orange)' : 'var(--gray-400)',
                cursor: 'pointer', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 5,
                position: 'relative', bottom: -1,
              }}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span style={{ background: 'var(--orange)', color: '#000', borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 700 }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback msg */}
      {msg && (
        <div style={{ margin: '12px 20px', padding: '10px 14px', background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)' }}>
          {msg}
        </div>
      )}

      {/* ── TAB: IN ATTESA ── */}
      {tab === 'pending' && (
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)' }}>
              {pending.length} spot in attesa
            </span>
            <button
              onClick={refreshPending}
              disabled={loadingPending}
              className="btn-ghost"
              style={{ fontSize: 12, opacity: loadingPending ? 0.5 : 1 }}
            >
              {loadingPending ? '...' : '🔄 Aggiorna'}
            </button>
          </div>
          {loadingPending ? (
            <Loading />
          ) : pending.length === 0 ? (
            <EmptyState icon="✅" text="Coda vuota. Nessuno spot da moderare." />
          ) : (
            pending.map(spot => (
              <AdminCard key={spot.id} spot={spot}
                onApprove={handleApprove} onReject={handleReject}
                onEdit={handleEdit} onDelete={handleDelete}
                loading={loading === spot.id}
              />
            ))
          )}
        </div>
      )}

      {/* ── TAB: TUTTI GLI SPOT ── */}
      {tab === 'all' && (
        <div style={{ padding: '16px 20px 0' }}>
          {loadingAll ? (
            <Loading />
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <select className="input-vhs" value={filterType} onChange={e => setFilterType(e.target.value as SpotType | 'all')} style={{ flex: 1, minWidth: 120 }}>
                  <option value="all">Tutti i tipi</option>
                  {Object.entries(TIPI_SPOT).map(([type, info]) => (
                    <option key={type} value={type}>{info.emoji} {info.label}</option>
                  ))}
                </select>
                <select className="input-vhs" value={filterCity} onChange={e => setFilterCity(e.target.value)} style={{ flex: 1, minWidth: 120 }}>
                  <option value="">Tutte le città</option>
                  {uniqueCities.map(c => <option key={c} value={c}>{CITTA_ITALIANE.find(x => x.value === c)?.label ?? c}</option>)}
                </select>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--orange)', display: 'flex', alignItems: 'center' }}>
                  {displayAll.length} spot
                </div>
              </div>
              {displayAll.length === 0 ? (
                <EmptyState icon="🏴" text="Nessuno spot trovato." />
              ) : (
                displayAll.map(spot => (
                  <AdminCard key={spot.id} spot={spot}
                    onApprove={handleApprove} onReject={handleReject}
                    onEdit={handleEdit} onDelete={handleDelete}
                    loading={loading === spot.id} showStatus
                  />
                ))
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB: COMMENTI ── */}
      {tab === 'comments' && (
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)' }}>
              {adminComments.length} commenti
            </span>
            <button
              onClick={() => { setAdminComments([]); setLoadingComments(true); fetch('/api/admin/comments').then(r => r.json()).then(j => { if (j.ok) setAdminComments(j.data); }).finally(() => setLoadingComments(false)); }}
              className="btn-ghost"
              style={{ fontSize: 12 }}
            >
              🔄 Aggiorna
            </button>
          </div>

          {loadingComments ? (
            <Loading />
          ) : adminComments.length === 0 ? (
            <EmptyState icon="💬" text="Nessun commento ancora." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {adminComments.map(c => (
                <div key={c.id} style={{
                  background: 'var(--gray-800)',
                  border: '1px solid var(--gray-700)',
                  borderRadius: 6,
                  padding: '12px 14px',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orange)' }}>
                        @{c.username}
                      </span>
                      {c.spots && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)', background: 'var(--gray-700)', padding: '1px 6px', borderRadius: 2 }}>
                          📍 {c.spots.name}{c.spots.city ? ` · ${c.spots.city}` : ''}
                        </span>
                      )}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-600)', marginLeft: 'auto' }}>
                        {new Date(c.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ color: 'var(--bone)', fontSize: 14, lineHeight: 1.5, margin: 0, wordBreak: 'break-word' }}>
                      {c.text}
                    </p>
                  </div>
                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteComment(c)}
                    style={{
                      background: 'none', border: '1px solid var(--gray-600)',
                      borderRadius: 4, padding: '4px 10px',
                      color: '#e05555', fontFamily: 'var(--font-mono)', fontSize: 11,
                      cursor: 'pointer', flexShrink: 0,
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#e05555')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--gray-600)')}
                  >
                    🗑️ Elimina
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: UTENTI ── */}
      {tab === 'users' && (
        <div style={{ padding: '16px 20px 0' }}>
          {/* Search + refresh bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <input
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              placeholder="Cerca @username..."
              className="input-vhs"
              style={{ flex: 1 }}
            />
            <button
              onClick={() => { setAdminUsers([]); setLoadingUsers(true); fetch('/api/admin/users').then(r => r.json()).then(j => { if (j.ok) setAdminUsers(j.data); }).finally(() => setLoadingUsers(false)); }}
              className="btn-ghost"
              style={{ fontSize: 12, flexShrink: 0 }}
            >
              🔄 Aggiorna
            </button>
          </div>

          {loadingUsers ? <Loading /> : (() => {
            const q = userSearch.toLowerCase().replace('@', '');
            const filtered = q ? adminUsers.filter(u => u.username.toLowerCase().includes(q)) : adminUsers;
            return filtered.length === 0 ? (
              <EmptyState icon="👤" text="Nessun utente trovato." />
            ) : (
              <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)', marginBottom: 10 }}>
                  {filtered.length} utenti registrati
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filtered.map(u => (
                    <div key={u.id} style={{
                      background: 'var(--gray-800)',
                      border: '1px solid var(--gray-700)',
                      borderRadius: 8,
                      padding: '14px 16px',
                    }}>
                      {/* User header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                        {/* Avatar */}
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%',
                          background: 'var(--orange)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-mono)', fontSize: 16, color: '#000',
                          fontWeight: 700, flexShrink: 0,
                        }}>
                          {u.username[0].toUpperCase()}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--orange)' }}>
                              @{u.username}
                            </span>
                            {u.instagram_handle && (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>
                                IG: @{u.instagram_handle}
                              </span>
                            )}
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-600)', marginLeft: 'auto' }}>
                              {new Date(u.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>

                          {/* Stats row */}
                          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: u.spot_count > 0 ? 'var(--bone)' : 'var(--gray-600)' }}>
                              🗺️ {u.spot_count} spot
                            </span>
                            {u.pending_spots > 0 && (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#ffce4d' }}>
                                ⏳ {u.pending_spots} in attesa
                              </span>
                            )}
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: u.comment_count > 0 ? 'var(--bone)' : 'var(--gray-600)' }}>
                              💬 {u.comment_count} commenti
                            </span>
                          </div>

                          {/* Bio */}
                          {u.bio && (
                            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', margin: '6px 0 0', lineHeight: 1.4, wordBreak: 'break-word' }}>
                              {u.bio.length > 120 ? u.bio.slice(0, 120) + '…' : u.bio}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <a
                          href={`/u/${u.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontFamily: 'var(--font-mono)', fontSize: 12,
                            background: 'transparent', border: '1px solid var(--gray-600)',
                            borderRadius: 4, color: 'var(--bone)',
                            padding: '6px 12px', cursor: 'pointer', textDecoration: 'none',
                            display: 'inline-flex', alignItems: 'center',
                          }}
                        >
                          🔗 Vedi profilo
                        </a>
                        {u.comment_count > 0 && (
                          <button
                            onClick={() => handleDeleteUserComments(u.username)}
                            style={{
                              fontFamily: 'var(--font-mono)', fontSize: 12,
                              background: 'transparent', border: '1px solid rgba(255,100,100,0.4)',
                              borderRadius: 4, color: '#e05555',
                              padding: '6px 12px', cursor: 'pointer',
                            }}
                          >
                            🗑️ Elimina commenti ({u.comment_count})
                          </button>
                        )}
                        <button
                          onClick={() => handleSuspendUser(u.username)}
                          style={{
                            fontFamily: 'var(--font-mono)', fontSize: 12,
                            background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.5)',
                            borderRadius: 4, color: '#ff4444',
                            padding: '6px 12px', cursor: 'pointer',
                          }}
                        >
                          ⛔ Sospendi
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── TAB: EVENTI ── */}
      {tab === 'events' && (
        <div style={{ padding: '16px 20px 0' }}>
          {/* Form editor */}
          {editingEvent ? (
            <EventForm
              event={editingEvent}
              onChange={setEditingEvent}
              onSave={saveEvent}
              onCancel={() => setEditingEvent(null)}
              saving={savingEvent}
            />
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)' }}>
                  {events.length} eventi
                </span>
                <button
                  onClick={() => setEditingEvent({ ...EMPTY_EVENT })}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 13, background: 'var(--orange)', color: '#000', border: 'none', borderRadius: 4, padding: '8px 16px', cursor: 'pointer' }}
                >
                  + Nuovo evento
                </button>
              </div>

              {loadingEvents ? <Loading /> : events.length === 0 ? (
                <EmptyState icon="📅" text="Nessun evento. Creane uno!" />
              ) : (
                events.map(e => (
                  <EventRow
                    key={e.id} event={e}
                    onEdit={() => setEditingEvent({ ...e })}
                    onDelete={() => deleteEvent(e.id, e.title)}
                  />
                ))
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB: NEWS ── */}
      {tab === 'news' && (
        <div style={{ padding: '16px 20px 0' }}>
          {editingNews ? (
            <NewsForm
              article={editingNews}
              onChange={setEditingNews}
              onSave={saveNews}
              onCancel={() => setEditingNews(null)}
              saving={savingNews}
            />
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)' }}>
                  {newsList.length} articoli
                </span>
                <button
                  onClick={() => setEditingNews({ ...EMPTY_NEWS })}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 13, background: 'var(--orange)', color: '#000', border: 'none', borderRadius: 4, padding: '8px 16px', cursor: 'pointer' }}
                >
                  + Nuovo articolo
                </button>
              </div>

              {loadingNews ? <Loading /> : newsList.length === 0 ? (
                <EmptyState icon="📰" text="Nessun articolo. Creane uno!" />
              ) : (
                newsList.map(n => (
                  <NewsRow
                    key={n.id} article={n}
                    onEdit={() => setEditingNews({ ...n })}
                    onDelete={() => deleteNews(n.id, n.title)}
                  />
                ))
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB: IMPORTA ── */}
      {tab === 'import' && (
        <div style={{ padding: '16px 20px 0' }}>
          <AdminImportKML onImportDone={(n) => { showMsg(`✅ Importati ${n} spot!`); setTab('all'); setAllSpots([]); }} />
        </div>
      )}

      {/* ── TAB: STATS ── */}
      {tab === 'stats' && (
        <div style={{ padding: '20px' }}>
          {allSpots.length === 0 && !loadingAll && (
            <div style={{ textAlign: 'center', paddingTop: 20 }}>
              <button onClick={() => { setLoadingAll(true); fetch('/api/admin/all-spots').then(r => r.json()).then(j => { if(j.ok) setAllSpots(j.data); }).finally(() => setLoadingAll(false)); }}
                className="btn-secondary" style={{ margin: '0 auto' }}>Carica statistiche</button>
            </div>
          )}
          {total > 0 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                <StatCard label="Spot online"       value={String(total)}                                    color="var(--orange)" />
                <StatCard label="In attesa"          value={String(pending.length)}                           color="#ffce4d" />
                <StatCard label="Alive"              value={String(byCondition.alive)}                        color="#00c851" />
                <StatCard label="Bustati/Demoliti"   value={String(byCondition.bustato + byCondition.demolito)} color="#888" />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Per tipo</div>
              {byType.map(({ type, info, count }) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 18, width: 28 }}>{info.emoji}</span>
                  <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)' }}>{info.label}</div>
                  <div style={{ width: `${total > 0 ? (count / total) * 140 : 0}px`, height: 8, background: info.color, borderRadius: 2 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--orange)', width: 30, textAlign: 'right' }}>{count}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════
   EVENT FORM
═══════════════════════════════════ */
function EventForm({
  event, onChange, onSave, onCancel, saving,
}: {
  event: Partial<AdminEvent>;
  onChange: (e: Partial<AdminEvent>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const set = (k: keyof AdminEvent, v: string) => onChange({ ...event, [k]: v });

  /* ── Spot search state ── */
  const [spotQ,      setSpotQ]      = useState('');
  const [spotRes,    setSpotRes]    = useState<SpotOption[]>([]);
  const [spotBusy,   setSpotBusy]   = useState(false);
  const [spotOpen,   setSpotOpen]   = useState(false);

  useEffect(() => {
    if (spotQ.length < 2) { setSpotRes([]); setSpotOpen(false); return; }
    const t = setTimeout(async () => {
      setSpotBusy(true);
      try {
        const r = await fetch('/api/admin/all-spots').then(x => x.json());
        if (r.ok) {
          const q = spotQ.toLowerCase();
          const filtered = (r.data as Array<{ id: string; name: string; slug: string; city?: string; status: string }>)
            .filter(s => s.status === 'approved' && (
              s.name.toLowerCase().includes(q) ||
              (s.city ?? '').toLowerCase().includes(q)
            ))
            .slice(0, 8)
            .map(s => ({ id: s.id, name: s.name, slug: s.slug, city: s.city }));
          setSpotRes(filtered);
          setSpotOpen(filtered.length > 0);
        }
      } catch { /* noop */ }
      setSpotBusy(false);
    }, 350);
    return () => clearTimeout(t);
  }, [spotQ]);

  const selectSpot = (s: SpotOption) => {
    onChange({ ...event, spot_id: s.id, spot: { name: s.name, slug: s.slug } });
    setSpotQ('');
    setSpotRes([]);
    setSpotOpen(false);
  };

  const clearSpot = () => onChange({ ...event, spot_id: null, spot: null });

  return (
    <div style={{ background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 8, padding: 20 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--orange)', marginBottom: 20 }}>
        {event.id ? '✏️ Modifica evento' : '+ Nuovo evento'}
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <label style={labelStyle}>Titolo *</label>
          <input style={inputStyle} value={event.title ?? ''} onChange={e => set('title', e.target.value)} placeholder="Titolo evento" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Data e ora *</label>
            <input type="datetime-local" style={inputStyle} value={event.event_date ? event.event_date.slice(0,16) : ''} onChange={e => set('event_date', e.target.value + ':00')} />
          </div>
          <div>
            <label style={labelStyle}>Stato</label>
            <select style={inputStyle} value={event.status ?? 'published'} onChange={e => set('status', e.target.value)}>
              <option value="published">✅ Pubblicato</option>
              <option value="draft">📝 Bozza</option>
            </select>
          </div>
        </div>

        {/* ── Spot collegato ── */}
        <div>
          <label style={labelStyle}>📍 Spot collegato (opzionale)</label>
          {event.spot_id ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              background: 'rgba(255,106,0,0.08)',
              border: '1px solid rgba(255,106,0,0.35)',
              borderRadius: 4,
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--orange)', flex: 1 }}>
                📍 {event.spot?.name ?? event.spot_id}
              </span>
              <button
                onClick={clearSpot}
                style={{ background: 'transparent', border: 'none', color: 'var(--gray-400)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                style={inputStyle}
                value={spotQ}
                onChange={e => setSpotQ(e.target.value)}
                onBlur={() => setTimeout(() => setSpotOpen(false), 180)}
                placeholder="Cerca uno spot nel database..."
              />
              {spotBusy && (
                <span style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)',
                }}>
                  ...
                </span>
              )}
              {spotOpen && spotRes.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
                  background: 'var(--gray-800)',
                  border: '1px solid var(--gray-600)',
                  borderRadius: '0 0 6px 6px',
                  maxHeight: 220, overflowY: 'auto',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                }}>
                  {spotRes.map(s => (
                    <div
                      key={s.id}
                      onMouseDown={() => selectSpot(s)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 12px', cursor: 'pointer',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,106,0,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', flex: 1 }}>
                        {s.name}
                      </span>
                      {s.city && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>
                          {s.city}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', marginTop: 4 }}>
            Collega un park/spot del database → comparirà come link diretto nella pagina eventi
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Location / Venue</label>
            <input style={inputStyle} value={event.location ?? ''} onChange={e => set('location', e.target.value)} placeholder="Nome del posto" />
          </div>
          <div>
            <label style={labelStyle}>Città</label>
            <input style={inputStyle} value={event.city ?? ''} onChange={e => set('city', e.target.value)} placeholder="es. Verona" />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Descrizione</label>
          <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} value={event.description ?? ''} onChange={e => set('description', e.target.value)} placeholder="Descrivi l'evento..." />
        </div>

        <div>
          <label style={labelStyle}>URL cover (immagine)</label>
          <input style={inputStyle} value={event.cover_url ?? ''} onChange={e => set('cover_url', e.target.value)} placeholder="https://..." />
        </div>

        <div>
          <label style={labelStyle}>Link info / iscrizioni</label>
          <input style={inputStyle} value={event.link_url ?? ''} onChange={e => set('link_url', e.target.value)} placeholder="https://..." />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button
          onClick={onSave} disabled={saving}
          style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 14, background: 'var(--orange)', color: '#000', border: 'none', borderRadius: 4, padding: '10px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Salvataggio...' : event.id ? '💾 Salva modifiche' : '✅ Crea evento'}
        </button>
        <button
          onClick={onCancel}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 14, background: 'transparent', color: 'var(--gray-400)', border: '1px solid var(--gray-700)', borderRadius: 4, padding: '10px 18px', cursor: 'pointer' }}
        >
          Annulla
        </button>
      </div>
    </div>
  );
}

function EventRow({ event: e, onEdit, onDelete }: { event: AdminEvent; onEdit: () => void; onDelete: () => void }) {
  const date = e.event_date ? new Date(e.event_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const isPast = e.event_date && new Date(e.event_date) < new Date();
  return (
    <div style={{ background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 8, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {e.title}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {date && <span>📅 {date}</span>}
          {e.city && <span>📍 {e.city}</span>}
          <span style={{ color: isPast ? 'var(--gray-400)' : '#00c851' }}>{isPast ? 'PASSATO' : 'PROSSIMO'}</span>
          <span style={{ color: e.status === 'published' ? 'var(--orange)' : 'var(--gray-400)' }}>{e.status === 'published' ? 'LIVE' : 'BOZZA'}</span>
        </div>
      </div>
      <button onClick={onEdit} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'transparent', border: '1px solid var(--gray-600)', borderRadius: 4, color: 'var(--bone)', padding: '6px 12px', cursor: 'pointer' }}>✏️</button>
      <button onClick={onDelete} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'transparent', border: '1px solid rgba(255,50,50,0.4)', borderRadius: 4, color: '#ff4444', padding: '6px 12px', cursor: 'pointer' }}>🗑️</button>
    </div>
  );
}

/* ═══════════════════════════════════
   NEWS FORM
═══════════════════════════════════ */
function NewsForm({
  article, onChange, onSave, onCancel, saving,
}: {
  article: Partial<AdminNews>;
  onChange: (n: Partial<AdminNews>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const set = (k: keyof AdminNews, v: string) => onChange({ ...article, [k]: v });

  return (
    <div style={{ background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 8, padding: 20 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--orange)', marginBottom: 20 }}>
        {article.id ? '✏️ Modifica articolo' : '+ Nuovo articolo'}
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <label style={labelStyle}>Titolo *</label>
          <input style={inputStyle} value={article.title ?? ''} onChange={e => set('title', e.target.value)} placeholder="Titolo dell'articolo" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Stato</label>
            <select style={inputStyle} value={article.status ?? 'draft'} onChange={e => set('status', e.target.value)}>
              <option value="draft">📝 Bozza</option>
              <option value="published">✅ Pubblicato</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Tag (virgola separati)</label>
            <input style={inputStyle} value={article.tags ?? ''} onChange={e => set('tags', e.target.value)} placeholder="bmx, spot, verona" />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Excerpt (anteprima)</label>
          <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} value={article.excerpt ?? ''} onChange={e => set('excerpt', e.target.value)} placeholder="Breve descrizione per i preview..." />
        </div>

        <div>
          <label style={labelStyle}>URL cover (immagine)</label>
          <input style={inputStyle} value={article.cover_url ?? ''} onChange={e => set('cover_url', e.target.value)} placeholder="https://..." />
        </div>

        <div>
          <label style={labelStyle}>Corpo articolo (supporta **grassetto**, *corsivo*, # Titolo, ## Sottotitolo, - liste)</label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: 240, lineHeight: 1.6 }}
            value={article.body ?? ''}
            onChange={e => set('body', e.target.value)}
            placeholder={`# Titolo sezione\n\nTesto del paragrafo qui...\n\n## Sottotitolo\n\n**Parola in grassetto** e *corsivo*.\n\n- Elemento lista\n- Elemento lista`}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button
          onClick={onSave} disabled={saving}
          style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 14, background: 'var(--orange)', color: '#000', border: 'none', borderRadius: 4, padding: '10px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Salvataggio...' : article.id ? '💾 Salva modifiche' : '✅ Pubblica articolo'}
        </button>
        <button
          onClick={onCancel}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 14, background: 'transparent', color: 'var(--gray-400)', border: '1px solid var(--gray-700)', borderRadius: 4, padding: '10px 18px', cursor: 'pointer' }}
        >
          Annulla
        </button>
      </div>
    </div>
  );
}

function NewsRow({ article: n, onEdit, onDelete }: { article: AdminNews; onEdit: () => void; onDelete: () => void }) {
  const date = n.published_at
    ? new Date(n.published_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date(n.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  const tags = n.tags ? n.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  return (
    <div style={{ background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 8, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
      {n.cover_url && (
        <img src={n.cover_url} alt={n.title} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {n.title}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>{date}</span>
          <span style={{ color: n.status === 'published' ? '#00c851' : 'var(--gray-400)' }}>{n.status === 'published' ? 'LIVE' : 'BOZZA'}</span>
          {tags.slice(0, 2).map(t => <span key={t} style={{ color: 'var(--orange)' }}>#{t}</span>)}
        </div>
      </div>
      <button onClick={onEdit} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'transparent', border: '1px solid var(--gray-600)', borderRadius: 4, color: 'var(--bone)', padding: '6px 12px', cursor: 'pointer' }}>✏️</button>
      <button onClick={onDelete} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'transparent', border: '1px solid rgba(255,50,50,0.4)', borderRadius: 4, color: '#ff4444', padding: '6px 12px', cursor: 'pointer' }}>🗑️</button>
    </div>
  );
}

/* ═══════════════════════════════════
   SHARED UTILS
═══════════════════════════════════ */
function Loading() {
  return (
    <div style={{ textAlign: 'center', paddingTop: 40, fontFamily: 'var(--font-mono)', color: 'var(--orange)', fontSize: 16 }}>
      CARICAMENTO...
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--bone)', fontSize: 16, lineHeight: 1.5 }}>{text}</p>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--gray-800)', border: `1px solid ${color}22`, borderRadius: 6, padding: '16px 18px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginTop: 4, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}
