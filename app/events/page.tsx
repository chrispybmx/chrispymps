import type { Metadata } from 'next';
import Link from 'next/link';
import EventsCalendar, { type CalendarEvent } from './EventsCalendar';
import { ProponiEventoBtn } from '@/components/CommunityActions';
import { supabaseServer } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Eventi BMX Italia — Gare, Jam e Contest | Chrispy Maps',
  description: 'Gare, jam, contest e raduni BMX, skate e scooter in Italia. Calendario eventi della community su Chrispy Maps.',
  alternates: { canonical: 'https://maps.chrispybmx.com/events' },
  keywords: ['eventi BMX Italia', 'gare BMX', 'jam BMX', 'contest skate Italia', 'raduni scooter'],
  openGraph: {
    title: 'Eventi BMX — Chrispy Maps',
    description: 'Calendario eventi BMX, skate e scooter in Italia.',
    url: 'https://maps.chrispybmx.com/events',
    siteName: 'Chrispy Maps',
    locale: 'it_IT',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', site: '@chrispy_bmx', title: 'Eventi BMX — Chrispy Maps' },
};

export const dynamic = 'force-dynamic';

async function getEvents(): Promise<CalendarEvent[]> {
  const supabase = supabaseServer();

  let result = await supabase
    .from('events')
    .select('*, spot:spots(name, slug)')
    .eq('status', 'published')
    .order('event_date', { ascending: true });

  if (result.error) {
    result = await supabase
      .from('events')
      .select('*')
      .eq('status', 'published')
      .order('event_date', { ascending: true });
  }

  if (result.error) {
    console.error('[events/page] Supabase error:', result.error.message);
    return [];
  }

  return (result.data ?? []) as CalendarEvent[];
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
          <Link href="/" style={{
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <ProponiEventoBtn />
        </div>
        <EventsCalendar events={events} />
      </div>
    </div>
  );
}
