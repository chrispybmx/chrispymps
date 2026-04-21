import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Eventi BMX — Chrispy Maps',
  description: 'Gare, jam, contest e raduni BMX in Italia. Tutti gli eventi della community.',
};

export const dynamic = 'force-dynamic';

interface Event {
  id: string;
  title: string;
  description?: string;
  location?: string;
  city?: string;
  event_date: string;
  cover_url?: string;
  link_url?: string;
  status: string;
}

async function getEvents(): Promise<Event[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://chrispybmx.com';
    const res = await fetch(`${baseUrl}/api/events`, { next: { revalidate: 60 } });
    const json = await res.json();
    return json.data ?? [];
  } catch { return []; }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return {
    day:   d.toLocaleDateString('it-IT', { day: '2-digit' }),
    month: d.toLocaleDateString('it-IT', { month: 'short' }).toUpperCase(),
    year:  d.getFullYear(),
    time:  d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    full:  d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

function isPast(dateStr: string) {
  return new Date(dateStr) < new Date();
}

export default async function EventsPage() {
  const events  = await getEvents();
  const upcoming = events.filter(e => !isPast(e.event_date));
  const past     = events.filter(e => isPast(e.event_date));

  return (
    <div style={{ background: 'var(--black)', minHeight: '100dvh' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--gray-700)', background: 'rgba(10,10,10,0.98)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/map" style={{ color: 'var(--gray-400)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            ← Mappa
          </Link>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--orange)' }}>
            📅 EVENTI
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 60px' }}>

        {events.length === 0 && (
          <EmptyState
            icon="📅"
            title="Nessun evento in programma"
            subtitle="Seguici su Instagram per non perdere nulla!"
          />
        )}

        {/* Prossimi eventi */}
        {upcoming.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <SectionLabel>🔥 PROSSIMI EVENTI</SectionLabel>
            {upcoming.map(e => <EventCard key={e.id} event={e} />)}
          </section>
        )}

        {/* Eventi passati */}
        {past.length > 0 && (
          <section>
            <SectionLabel style={{ color: 'var(--gray-400)' }}>📁 EVENTI PASSATI</SectionLabel>
            {past.map(e => <EventCard key={e.id} event={e} past />)}
          </section>
        )}
      </div>
    </div>
  );
}

function EventCard({ event: e, past }: { event: Event; past?: boolean }) {
  const dt = formatDate(e.event_date);
  return (
    <div style={{
      background: 'var(--gray-800)',
      border: `1px solid ${past ? 'var(--gray-700)' : 'var(--gray-600)'}`,
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 14,
      opacity: past ? 0.7 : 1,
    }}>
      {/* Cover */}
      {e.cover_url && (
        <div style={{ height: 180, overflow: 'hidden', position: 'relative' }}>
          <img src={e.cover_url} alt={e.title} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: past ? 'grayscale(0.4)' : 'none' }} loading="lazy" />
          {past && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--gray-400)', background: 'rgba(10,10,10,0.8)', padding: '6px 14px', borderRadius: 4 }}>PASSATO</span>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 0 }}>
        {/* Data block */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '16px 18px',
          borderRight: '1px solid var(--gray-700)',
          minWidth: 70,
          background: past ? 'transparent' : 'rgba(255,106,0,0.06)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: past ? 'var(--gray-400)' : 'var(--orange)', lineHeight: 1 }}>{dt.day}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: past ? 'var(--gray-400)' : 'var(--orange)', marginTop: 2 }}>{dt.month}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginTop: 1 }}>{dt.year}</div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, padding: '14px 16px' }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--bone)', margin: '0 0 4px', lineHeight: 1.2 }}>
            {e.title}
          </h2>
          {(e.location || e.city) && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)', marginBottom: 6 }}>
              📍 {[e.location, e.city].filter(Boolean).join(' — ')}
            </div>
          )}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginBottom: 8 }}>
            🕐 {dt.time}
          </div>
          {e.description && (
            <p style={{ color: 'var(--bone)', fontSize: 14, lineHeight: 1.5, margin: '0 0 10px' }}>
              {e.description}
            </p>
          )}
          {e.link_url && !past && (
            <a href={e.link_url} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontFamily: 'var(--font-mono)', fontSize: 13, color: '#000',
              background: 'var(--orange)', padding: '6px 14px', borderRadius: 4,
              textDecoration: 'none',
            }}>
              Info & Iscrizioni ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, ...style }}>
      {children}
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 60, paddingBottom: 40 }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--bone)', marginBottom: 8 }}>{title}</div>
      <div style={{ color: 'var(--gray-400)', fontSize: 14 }}>{subtitle}</div>
      <Link href="/map" style={{ display: 'inline-block', marginTop: 24, fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--orange)', textDecoration: 'none', border: '1px solid var(--orange)', padding: '10px 20px', borderRadius: 4 }}>
        ← Torna alla mappa
      </Link>
    </div>
  );
}
