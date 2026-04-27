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
  const [viewMonth, setViewMonth] = useState(today.getMonth());
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
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
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
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--bone)', letterSpacing: '0.06em' }}>
              {MESI[viewMonth].toUpperCase()} {viewYear}
            </span>
          </div>
          {!isCurrentView && (
            <button onClick={goToday} style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--orange)',
              background: 'transparent', border: '1px solid rgba(255,106,0,0.5)',
              borderRadius: 8, padding: '2px 8px', cursor: 'pointer', letterSpacing: '0.06em',
            }}>
              OGGI
            </button>
          )}
          <button onClick={nextMonth} style={navBtnStyle}>›</button>
        </div>

        {/* Intestazioni giorni */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '10px 8px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {GIORNI.map(g => (
            <div key={g} style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', letterSpacing: '0.08em', paddingBottom: 4 }}>
              {g}
            </div>
          ))}
        </div>

        {/* Griglia giorni — tutti cliccabili */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '4px 8px 12px' }}>
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
                onClick={() => setSelDay(isSel ? null : dStr)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '4px 2px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <div style={{
                  width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%',
                  background: isSel
                    ? hasEv ? 'var(--orange)' : 'var(--gray-600)'
                    : isToday
                    ? 'rgba(255,106,0,0.15)'
                    : 'transparent',
                  border: isToday && !isSel ? '1px solid rgba(255,106,0,0.6)' : '1px solid transparent',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: isToday ? 700 : 400,
                  color: isSel ? '#fff' : isPast ? 'var(--gray-500)' : 'var(--bone)',
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
                        background: isSel ? 'rgba(255,255,255,0.6)' : 'var(--orange)',
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

      {/* ═══════════════════════════
          GIORNO SELEZIONATO
      ═══════════════════════════ */}
      {selDay && (
        <div style={{ marginBottom: 28 }}>
          <SectionLabel color="var(--orange)">
            📅 {fmtDayLabel(selDay)}
          </SectionLabel>
          {selEvents.length > 0 ? (
            selEvents.map(e => <EventCard key={e.id} event={e} />)
          ) : (
            <div style={{
              background: 'var(--gray-800)', border: '1px solid var(--gray-700)',
              borderRadius: 10, padding: '20px 18px',
              fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)',
              textAlign: 'center',
            }}>
              Nessun evento in questo giorno
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════
          PROSSIMI EVENTI — stile locandina
      ═══════════════════════════ */}
      {upcoming.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <SectionLabel color="var(--orange)">🔥 PROSSIMI EVENTI</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {upcoming.map(e => <PosterCard key={e.id} event={e} />)}
          </div>
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
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 17, color: 'var(--bone)', marginBottom: 8 }}>
            Nessun evento in programma
          </div>
          <div style={{ color: 'var(--gray-400)', fontSize: 14, marginBottom: 24 }}>
            Seguici su Instagram per non perdere nulla!
          </div>
          <Link href="/" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--orange)', textDecoration: 'none', border: '1px solid var(--orange)', padding: '10px 22px', borderRadius: 6 }}>
            ← Torna alla mappa
          </Link>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   POSTER CARD — locandina per prossimi eventi
═══════════════════════════════════════ */
function PosterCard({ event: e }: { event: CalendarEvent }) {
  const d    = new Date(e.event_date);
  const day  = String(d.getDate()).padStart(2, '0');
  const mon  = d.toLocaleDateString('it-IT', { month: 'short' }).toUpperCase().replace('.', '');
  const yr   = d.getFullYear();
  const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  if (e.cover_url) {
    return (
      <div style={{
        position: 'relative',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 6px 32px rgba(0,0,0,0.7)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}>
        {/* Cover image */}
        <img
          src={e.cover_url}
          alt={e.title}
          style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
          loading="lazy"
        />

        {/* Gradient overlay bottom */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.92) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Date badge top-left */}
        <div style={{
          position: 'absolute', top: 14, left: 14,
          background: 'var(--orange)', color: '#000',
          borderRadius: 10, padding: '8px 12px',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.6)',
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{day}</div>
          <div style={{ fontSize: 11, marginTop: 2, letterSpacing: '0.06em' }}>{mon} {yr}</div>
        </div>

        {/* Content overlay bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '16px 18px 20px',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-mono)', fontSize: 20,
            color: '#fff', margin: '0 0 5px', lineHeight: 1.25,
            textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          }}>
            {e.title}
          </h2>

          {(e.location || e.city) && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: e.description ? 6 : 10 }}>
              📍 {[e.location, e.city].filter(Boolean).join(' — ')} · 🕐 {time}
            </div>
          )}

          {e.description && (
            <p style={{
              color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1.5,
              margin: '0 0 12px',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
            }}>
              {e.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {e.link_url && (
              <a
                href={e.link_url} target="_blank" rel="noopener noreferrer"
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                  color: '#000', background: 'var(--orange)',
                  padding: '8px 18px', borderRadius: 8, textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                Info & Iscrizioni ↗
              </a>
            )}
            {e.spot && (
              <Link
                href={`/spot/${e.spot.slug}`}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 13,
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)',
                  padding: '7px 14px', borderRadius: 8, textDecoration: 'none',
                  display: 'inline-block', backdropFilter: 'blur(4px)',
                  background: 'rgba(255,255,255,0.08)',
                }}
              >
                🗺️ Spot
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* Nessuna cover — card compatta con accent arancione */
  return (
    <div style={{
      background: 'var(--gray-800)',
      border: '1px solid var(--gray-600)',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex' }}>
        {/* Colonna data */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '18px 20px',
          borderRight: '1px solid var(--gray-700)',
          minWidth: 76, flexShrink: 0,
          background: 'rgba(255,106,0,0.06)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 30, color: 'var(--orange)', lineHeight: 1 }}>{day}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)', marginTop: 3, letterSpacing: '0.05em' }}>{mon}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', marginTop: 1 }}>{yr}</div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, padding: '14px 16px', minWidth: 0 }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 17, color: 'var(--bone)', margin: '0 0 5px', lineHeight: 1.25 }}>
            {e.title}
          </h2>

          {(e.location || e.city) && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginBottom: 3 }}>
              📍 {[e.location, e.city].filter(Boolean).join(' — ')}
            </div>
          )}

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginBottom: 8 }}>
            🕐 {time}
          </div>

          {e.description && (
            <p style={{ color: 'var(--bone)', fontSize: 13, lineHeight: 1.5, margin: '0 0 10px' }}>
              {e.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {e.link_url && (
              <a
                href={e.link_url} target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#000', background: 'var(--orange)', padding: '6px 14px', borderRadius: 6, textDecoration: 'none' }}
              >
                Info & Iscrizioni ↗
              </a>
            )}
            {e.spot && (
              <Link
                href={`/spot/${e.spot.slug}`}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--bone)', border: '1px solid var(--gray-600)', padding: '5px 12px', borderRadius: 6, textDecoration: 'none' }}
              >
                🗺️ Spot
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   EVENT CARD — stile compatto per passati / giorno selezionato
═══════════════════════════════════════ */
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
      {e.cover_url && (
        <div style={{ height: 160, overflow: 'hidden', position: 'relative' }}>
          <img
            src={e.cover_url} alt={e.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: past ? 'grayscale(0.5)' : 'none' }}
            loading="lazy"
          />
          {past && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-300)', background: 'rgba(0,0,0,0.7)', padding: '4px 12px', borderRadius: 4 }}>PASSATO</span>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '14px 16px',
          borderRight: '1px solid var(--gray-700)',
          minWidth: 68, flexShrink: 0,
          background: past ? 'transparent' : 'rgba(255,106,0,0.06)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, color: past ? 'var(--gray-400)' : 'var(--orange)', lineHeight: 1 }}>{day}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: past ? 'var(--gray-400)' : 'var(--orange)', marginTop: 3 }}>{mon}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', marginTop: 1 }}>{yr}</div>
        </div>

        <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--bone)', margin: '0 0 5px', lineHeight: 1.25 }}>
            {e.title}
          </h2>

          {e.spot ? (
            <Link href={`/spot/${e.spot.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orange)', textDecoration: 'none', marginBottom: 4 }}>
              📍 {e.spot.name} ↗
            </Link>
          ) : (e.location || e.city) ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginBottom: 4 }}>
              📍 {[e.location, e.city].filter(Boolean).join(' — ')}
            </div>
          ) : null}

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginBottom: 8 }}>🕐 {time}</div>

          {e.description && (
            <p style={{ color: 'var(--bone)', fontSize: 13, lineHeight: 1.5, margin: '0 0 10px' }}>
              {e.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {e.link_url && !past && (
              <a href={e.link_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#000', background: 'var(--orange)', padding: '5px 12px', borderRadius: 4, textDecoration: 'none' }}>
                Info & Iscrizioni ↗
              </a>
            )}
            {e.spot && (
              <Link href={`/spot/${e.spot.slug}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--bone)', border: '1px solid var(--gray-600)', padding: '4px 10px', borderRadius: 4, textDecoration: 'none' }}>
                🗺️ Vai allo spot
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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
