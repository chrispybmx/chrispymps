'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminCard from '@/components/AdminCard';
import AdminImportKML from '@/components/AdminImportKML';
import type { Spot, SpotType } from '@/lib/types';
import { TIPI_SPOT, CITTA_ITALIANE } from '@/lib/constants';

type Tab = 'pending' | 'all' | 'import' | 'stats';

interface AdminDashboardProps {
  initialSpots: Spot[];
}

export default function AdminDashboard({ initialSpots }: AdminDashboardProps) {
  const router = useRouter();
  const [tab,       setTab]     = useState<Tab>('pending');
  const [pending,   setPending] = useState<Spot[]>(initialSpots);
  const [allSpots,  setAllSpots] = useState<Spot[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loading,   setLoading] = useState<string | null>(null);
  const [msg,       setMsg]     = useState<string | null>(null);
  const [filterType, setFilterType] = useState<SpotType | 'all'>('all');
  const [filterCity, setFilterCity] = useState('');

  // Carica tutti gli spot quando si apre il tab
  useEffect(() => {
    if (tab !== 'all' || allSpots.length > 0) return;
    setLoadingAll(true);
    fetch('/api/admin/all-spots')
      .then(r => r.json())
      .then(j => { if (j.ok) setAllSpots(j.data); })
      .finally(() => setLoadingAll(false));
  }, [tab]);

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000); };

  /* ── Azioni spot ── */
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
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--orange)' }}>
            🏴 CHRISPY MAPS — ADMIN
          </div>
          <button onClick={handleLogout} className="btn-ghost" style={{ fontSize: 13 }}>Logout</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', padding: '0 20px', gap: 4, marginTop: 10 }}>
          {([
            { key: 'pending', label: '📥 In attesa', badge: pending.length },
            { key: 'all',     label: '🗺️ Tutti gli spot' },
            { key: 'import',  label: '📥 Importa Maps' },
            { key: 'stats',   label: '📊 Stats' },
          ] as { key: Tab; label: string; badge?: number }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 13,
                padding: '8px 12px',
                border: `1px solid ${tab === t.key ? 'var(--orange)' : 'var(--gray-700)'}`,
                borderBottom: tab === t.key ? '1px solid var(--black)' : '1px solid var(--gray-700)',
                borderRadius: '4px 4px 0 0',
                background: tab === t.key ? 'var(--black)' : 'transparent',
                color: tab === t.key ? 'var(--orange)' : 'var(--gray-400)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                position: 'relative', bottom: -1,
              }}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span style={{ background: 'var(--orange)', color: '#000', borderRadius: 10, padding: '0 6px', fontSize: 11, fontWeight: 700 }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Msg feedback */}
      {msg && (
        <div style={{ margin: '12px 20px', padding: '10px 14px', background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)' }}>
          {msg}
        </div>
      )}

      {/* ── TAB: IN ATTESA ── */}
      {tab === 'pending' && (
        <div style={{ padding: '16px 20px 0' }}>
          {pending.length === 0 ? (
            <EmptyState icon="✅" text="Coda vuota. Nessuno spot da moderare." />
          ) : (
            pending.map(spot => (
              <AdminCard
                key={spot.id}
                spot={spot}
                onApprove={handleApprove}
                onReject={handleReject}
                onEdit={handleEdit}
                onDelete={handleDelete}
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
            <div style={{ textAlign: 'center', paddingTop: 40, fontFamily: 'var(--font-mono)', color: 'var(--orange)', fontSize: 16 }}>
              CARICAMENTO...
            </div>
          ) : (
            <>
              {/* Filtri */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <select
                  className="input-vhs"
                  value={filterType}
                  onChange={e => setFilterType(e.target.value as SpotType | 'all')}
                  style={{ flex: 1, minWidth: 120 }}
                >
                  <option value="all">Tutti i tipi</option>
                  {Object.entries(TIPI_SPOT).map(([type, info]) => (
                    <option key={type} value={type}>{info.emoji} {info.label}</option>
                  ))}
                </select>
                <select
                  className="input-vhs"
                  value={filterCity}
                  onChange={e => setFilterCity(e.target.value)}
                  style={{ flex: 1, minWidth: 120 }}
                >
                  <option value="">Tutte le città</option>
                  {uniqueCities.map(c => (
                    <option key={c} value={c}>{CITTA_ITALIANE.find(x => x.value === c)?.label ?? c}</option>
                  ))}
                </select>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--orange)', display: 'flex', alignItems: 'center' }}>
                  {displayAll.length} spot
                </div>
              </div>

              {displayAll.length === 0 ? (
                <EmptyState icon="🏴" text="Nessuno spot trovato con questi filtri." />
              ) : (
                displayAll.map(spot => (
                  <AdminCard
                    key={spot.id}
                    spot={spot}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    loading={loading === spot.id}
                    showStatus
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
              {/* KPI */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                <StatCard label="Spot online" value={String(total)} color="var(--orange)" />
                <StatCard label="In attesa" value={String(pending.length)} color="#ffce4d" />
                <StatCard label="Alive" value={String(byCondition.alive)} color="#00c851" />
                <StatCard label="Bustati/Demoliti" value={String(byCondition.bustato + byCondition.demolito)} color="#888" />
              </div>

              {/* Per tipo */}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                Per tipo
              </div>
              {byType.map(({ type, info, count }) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 18, width: 28 }}>{info.emoji}</span>
                  <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)' }}>{info.label}</div>
                  <div style={{ width: `${total > 0 ? (count / total) * 140 : 0}px`, height: 8, background: info.color, borderRadius: 2, transition: 'width 0.4s' }} />
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
