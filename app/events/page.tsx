import type { Metadata } from 'next';
import Link from 'next/link';
import EventsCalendar, { type CalendarEvent } from './EventsCalendar';

export const metadata: Metadata = {
  title: 'Eventi BMX — Chrispy Maps',
  description: 'Gare, jam, contest e raduni BMX in Italia. Tutti gli eventi della community.',
};

export const dynamic = 'force-dynamic';

async function getEvents(): Promise<CalendarEvent[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://chrispybmx.com';
    const res  = await fetch(`${baseUrl}/api/events`, { cache: 'no-store' });
    const json = await res.json();
    return json.data ?? [];
  } catch { return []; }
}

export default async function EventsPage() {
  const events = await getEvents();

  return (
    <div style={{ background: 'var(--black)', minHeight: '100dvh' }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid var(--gray-700)',
        background: 'rgba(10,10,10,0.98)',
        position: 'sticky', top: 0, zIndex: 20,
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{
          maxWidth: 640, margin: '0 auto',
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Link href="/map" style={{
            color: 'var(--gray-400)', textDecoration: 'none',
            fontFamily: 'var(--font-mono)', fontSize: 13,
          }}>
            ← Mappa
          </Link>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)' }}>
            📅 EVENTI
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 60px' }}>
        <EventsCalendar events={events} />
      </div>
    </div>
  );
}
