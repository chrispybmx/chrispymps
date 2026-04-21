'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

export interface CalendarEvent {
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

const MESI = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre',
];
const GIORNI = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function eventDateKey(e: CalendarEvent): string {
  return e.event_date.slice(0, 10);
}

function fmtDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
}

const navBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--gray-700)',
  borderRadius: 6,
  color: 'var(--bone)',
  fontSize: 22,
  width: 34,
  height: 34,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontFamily: 'var(--font-mono)',
  padding: 0,
  flexShrink: 0,
  lineHeight: 1,
};

export default function EventsCalendar({ events }: { events: CalendarEvent[] }) {
  const today    = new Date();
  const todayStr = toDateStr(today);

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [selDay,    setSelDay]    = useState<string | null>(null);

  /* ── Event lookup by date key ── */
  const byDay = useMemo<Record<string, CalendarEvent[]>>(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) {
      const k = eventDateKey(e);
      (map[k] ??= []).push(e);
    }
    return map;
  }, [events]);

  /* ── Calendar grid ── */
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const offset       = (firstWeekday + 6) % 7; // Mon=0

  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  /* ── Navigation ── */
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else { setViewMonth(m => m - 1); }
    setSelDay(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else { setViewMonth(m => m + 1); }
    setSelDay(null);
  };
  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelDay(todayStr);
  };

  const isCurrentView = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const selEvents     = selDay ? (byDay[selDay] ?? []) : [];

  const now      = new Date();
  const upcoming = events
    .filter(e => new Date(e.event_date) >= now)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
  const past = events
    .filter(e => new Date(e.event_date) < now)
    .sort((a, b) => b.event_date.localeCompare(a.event_date));

  return (
    <div>
      {/* ═══════════════════════════
          CALENDARIO
      ═══════════════════════════ */}
      <div style={{
        background: 'var(--gray-800)',
        border: '1px solid var(--gray-700)',
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 24,
        boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
      }}>
        {/* Header mese */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 14px',
          borderBottom: '1px solid var(--gray-700)',
          background: 'rgba(255,106,0,0.04)',
        }}>
          <button onClick={prevMonth} style={navBtnStyle}>‹</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 16,
              color: 'var(--bone)', letterSpacing: '0.06em',
            }}>
              {MESI[viewMonth].toUpperCase()} {viewYear}
            </span>
          </div>
          {!isCurrentView && (
            <button
              onClick={goToday}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--orange)',
                background: 'transparent', border: '1px solid rgba(255,106,0,0.5)',
                borderRadius: 8, padding: '2px 8px', cursor: 'pointer',
                letterSpacing: '0.06em',
              }}
            >
              OGGI
            </button>
          )}
          <button onClick={nextMonth} style={navBtnStyle}>›</button>
        </div>

        {/* Intestazioni giorni */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          padding: '10px 8px 4px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          {GIORNI.map(g => (
            <div key={g} style={{
              textAlign: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--gray-400)', letterSpacing: '0.08em',
              paddingBottom: 4,
            }}>
              {g}
            </div>
          ))}
        </div>

        {/* Griglia giorni */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          padding: '4px 8px 12px',
        }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} style={{ height: 46 }} />;

            const dStr   = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dStr === todayStr;
            const isSel   = dStr === selDay;
            const evs     = byDay[dStr] ?? [];
            const hasEv   = evs.length > 0;
            const isPast  = new Date(viewYear, viewMonth, day) <
                            new Date(today.getFullYear(), today.getMonth(), today.getDate());

            return (
              <div
                key={dStr}
                onClick={() => hasEv && setSelDay(isSel ? null : dStr)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '4px 2px',
                  cursor: hasEv ? 'pointer' : 'default',
                  userSelect: 'none',
                }}
              >
                {/* Cerchio giorno */}
                <div style={{
                  width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%',
                  background: isSel
                    ? 'var(--orange)'
                    : isToday
                    ? 'rgba(255,106,0,0.15)'
                    : 'transparent',
                  border: isToday && !isSel
                    ? '1px solid rgba(255,106,0,0.6)'
                    : '1px solid transparent',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: isToday ? 700 : 400,
                  color: isSel ? '#000' : isPast ? 'var(--gray-400)' : 'var(--bone)',
                  transition: 'background 0.12s',
                }}>
                  {day}
                </div>
                {/* Dot eventi */}
                {hasEv && (
                  <div style={{ display: 'flex', gap: 3, marginTop: 3, height: 5 }}>
                    {evs.slice(0, 3).map((_, j) => (
                      <div key={j} style={{
                        width: 4, height: 4, borderRadius: '50%',
                        background: isSel ? 'rgba(0,0,0,0.45)' : 'var(--orange)',
                        opacity: isPast ? 0.35 : 1,
                      }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Legenda ── */}
      <div style={{
        display: 'flex', gap: 16, flexWrap: 'wrap',
        marginBottom: 28,
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--gray-400)', letterSpacing: '0.06em',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--orange)', display: 'inline-block' }} />
          EVENTO
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid rgba(255,106,0,0.6)', display: 'inline-block' }} />
          OGGI
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--orange)', display: 'inline-block' }} />
          GIORNO SELEZIONATO
        </span>
      </div>

      {/* ═══════════════════════════
          EVENTI GIORNO SELEZIONATO
      ═══════════════════════════ */}
      {selDay && selEvents.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <SectionLabel color="var(--orange)">
            📅 {fmtDayLabel(selDay)}
          </SectionLabel>
          {selEvents.map(e => <EventCard key={e.id} event={e} />)}
        </div>
      )}

      {/* ═══════════════════════════
          PROSSIMI EVENTI
      ═══════════════════════════ */}
      {upcoming.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <SectionLabel color="var(--orange)">🔥 PROSSIMI EVENTI</SectionLabel>
          {upcoming.map(e => <EventCard key={e.id} event={e} />)}
        </section>
      )}

      {/* ═══════════════════════════
          EVENTI PASSATI
      ═══════════════════════════ */}
      {past.length > 0 && (
        <section>
          <SectionLabel color="var(--gray-400)">📁 EVENTI PASSATI</SectionLabel>
          {past.map(e => <EventCard key={e.id} event={e} past />)}
        </section>
      )}

      {/* ═══════════════════════════
          EMPTY STATE
      ═══════════════════════════ */}
      {events.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>📅</div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 17,
            color: 'var(--bone)', marginBottom: 8,
          }}>
            Nessun evento in programma
          </div>
          <div style={{ color: 'var(--gray-400)', fontSize: 14, marginBottom: 24 }}>
            Seguici su Instagram per non perdere nulla!
          </div>
          <Link href="/map" style={{
            fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--orange)',
            textDecoration: 'none', border: '1px solid var(--orange)',
            padding: '10px 22px', borderRadius: 6,
          }}>
            ← Torna alla mappa
          </Link>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════ */

function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 11,
      color, textTransform: 'uppercase', letterSpacing: '0.08em',
      marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function EventCard({ event: e, past }: { event: CalendarEvent; past?: boolean }) {
  const d    = new Date(e.event_date);
  const day  = String(d.getDate()).padStart(2, '0');
  const mon  = d.toLocaleDateString('it-IT', { month: 'short' }).toUpperCase().replace('.', '');
  const yr   = d.getFullYear();
  const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{
      background: 'var(--gray-800)',
      border: `1px solid ${past ? 'var(--gray-700)' : 'var(--gray-600)'}`,
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 14,
      opacity: past ? 0.65 : 1,
    }}>
      {/* Cover */}
      {e.cover_url && (
        <div style={{ height: 180, overflow: 'hidden', position: 'relative' }}>
          <img
            src={e.cover_url} alt={e.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: past ? 'grayscale(0.5)' : 'none' }}
            loading="lazy"
          />
          {past && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 12,
                color: 'var(--gray-300)',
                background: 'rgba(0,0,0,0.7)',
                padding: '4px 12px', borderRadius: 4,
              }}>
                PASSATO
              </span>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex' }}>
        {/* Data */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '14px 16px',
          borderRight: '1px solid var(--gray-700)',
          minWidth: 68, flexShrink: 0,
          background: past ? 'transparent' : 'rgba(255,106,0,0.06)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, color: past ? 'var(--gray-400)' : 'var(--orange)', lineHeight: 1 }}>
            {day}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: past ? 'var(--gray-400)' : 'var(--orange)', marginTop: 3 }}>
            {mon}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', marginTop: 1 }}>
            {yr}
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
          <h2 style={{
            fontFamily: 'var(--font-mono)', fontSize: 16,
            color: 'var(--bone)', margin: '0 0 5px', lineHeight: 1.25,
          }}>
            {e.title}
          </h2>

          {/* Location: spot linkato o testo libero */}
          {e.spot ? (
            <Link href={`/spot/${e.spot.slug}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'var(--orange)', textDecoration: 'none', marginBottom: 4,
            }}>
              📍 {e.spot.name} ↗
            </Link>
          ) : (e.location || e.city) ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginBottom: 4 }}>
              📍 {[e.location, e.city].filter(Boolean).join(' — ')}
            </div>
          ) : null}

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginBottom: 8 }}>
            🕐 {time}
          </div>

          {e.description && (
            <p style={{ color: 'var(--bone)', fontSize: 13, lineHeight: 1.5, margin: '0 0 10px' }}>
              {e.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {e.link_url && !past && (
              <a
                href={e.link_url} target="_blank" rel="noopener noreferrer"
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  color: '#000', background: 'var(--orange)',
                  padding: '5px 12px', borderRadius: 4, textDecoration: 'none',
                }}
              >
                Info & Iscrizioni ↗
              </a>
            )}
            {e.spot && (
              <Link
                href={`/spot/${e.spot.slug}`}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  color: 'var(--bone)',
                  border: '1px solid var(--gray-600)',
                  padding: '4px 10px', borderRadius: 4, textDecoration: 'none',
                }}
              >
                🗺️ Vai allo spot
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
