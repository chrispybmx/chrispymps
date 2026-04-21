'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminCard from '@/components/AdminCard';
import type { Spot } from '@/lib/types';

interface AdminDashboardProps {
  initialSpots: Spot[];
}

export default function AdminDashboard({ initialSpots }: AdminDashboardProps) {
  const router   = useRouter();
  const [spots,   setSpots]   = useState<Spot[]>(initialSpots);
  const [loading, setLoading] = useState<string | null>(null);
  const [msg,     setMsg]     = useState<string | null>(null);

  const removeSpot = (id: string) => setSpots((s) => s.filter((x) => x.id !== id));

  const handleApprove = useCallback(async (id: string) => {
    setLoading(id);
    setMsg(null);
    try {
      const res  = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spot_id: id }),
      });
      const json = await res.json();
      if (json.ok) {
        removeSpot(id);
        setMsg('✅ Spot approvato e online!');
      } else {
        setMsg('❌ Errore: ' + json.error);
      }
    } catch {
      setMsg('❌ Errore di rete');
    } finally {
      setLoading(null);
    }
  }, []);

  const handleReject = useCallback(async (id: string) => {
    const reason = window.prompt('Motivo del rifiuto (opzionale):');
    if (reason === null) return; // ha premuto Annulla

    setLoading(id);
    setMsg(null);
    try {
      const res  = await fetch('/api/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spot_id: id, reason: reason || undefined }),
      });
      const json = await res.json();
      if (json.ok) {
        removeSpot(id);
        setMsg('🗑️ Spot rifiutato.');
      } else {
        setMsg('❌ Errore: ' + json.error);
      }
    } catch {
      setMsg('❌ Errore di rete');
    } finally {
      setLoading(null);
    }
  }, []);

  const handleEdit = useCallback((id: string) => {
    router.push(`/admin/${id}`);
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  return (
    <div style={{
      background: 'var(--black)',
      minHeight: '100dvh',
      paddingBottom: 40,
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0,
        background: 'rgba(10,10,10,0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--gray-700)',
        padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 30,
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--orange)' }}>
            🏴 ADMIN
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)' }}>
            {spots.length} spot in attesa
          </div>
        </div>
        <button onClick={handleLogout} className="btn-ghost" style={{ fontSize: 14 }}>
          Logout
        </button>
      </div>

      {/* Messaggio feedback */}
      {msg && (
        <div style={{
          margin: '16px 20px 0',
          padding: '10px 16px',
          background: 'var(--gray-800)',
          border: '1px solid var(--gray-600)',
          borderRadius: 4,
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          color: 'var(--bone)',
        }}>
          {msg}
        </div>
      )}

      {/* Lista spot */}
      <div style={{ padding: '16px 20px 0' }}>
        {spots.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--bone)', fontSize: 18 }}>
              Coda vuota.<br />Nessuno spot da moderare.
            </p>
          </div>
        ) : (
          spots.map((spot) => (
            <AdminCard
              key={spot.id}
              spot={spot}
              onApprove={handleApprove}
              onReject={handleReject}
              onEdit={handleEdit}
              loading={loading === spot.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
