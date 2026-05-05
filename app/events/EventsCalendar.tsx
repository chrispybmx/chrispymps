'use client';

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const EventsMap = dynamic(() => import('./EventsMap'), { ssr: false });

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  city?: string;
  event_date: string;
  date_end?: string | null;
  cover_url?: string;
  link_url?: string;
  status: string;
  spot_id?: string | null;
  spot?: { name: string; slug: string } | null;
  // Native columns (post 20260504 migration)
  slug?: string | null;
  country?: string | null;
  country_code?: string | null;
  discipline?: string | null;
  level?: string | null;
  organizer?: string | null;
  registration_url?: string | null;
  source_url?: string | null;
  source_aggregator?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/** Estrae solo data YYYY-MM-DD da un campo che può essere TIMESTAMPTZ ('2026-05-04T00:00:00+00:00') */
function dateOnly(s: string): string {
  return (s || '').slice(0, 10);
}

/** Export evento come .ics file scaricabile (Apple/Google Calendar) */
function downloadICS(e: CalendarEvent) {
  const fmt = (d: string) => dateOnly(d).replace(/-/g, '');
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const dtstart = fmt(e.event_date);
  const dtend = e.date_end ? fmt(e.date_end) : dtstart;
  const uid = `${e.id}@chrispybmx.com`;
  const summary = e.title.replace(/\n/g, ' ').replace(/[,;\\]/g, '\\$&');
  const location = [e.city, e.country].filter(Boolean).join(', ').replace(/[,;\\]/g, '\\$&');
  const url = `https://maps.chrispybmx.com/events`;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chrispy Maps//Events//IT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `DTEND;VALUE=DATE:${dtend}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    `URL:${url}`,
    `DESCRIPTION:Evento BMX su Chrispy Maps. ${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  // Safari friendly: usa data URL invece di blob URL (alcuni Safari bloccano blob download)
  const filename = `${e.title.slice(0, 50).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`;
  const dataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Haversine distance in km between two lat/lng */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
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

export default function EventsCalendar({ events: rawEvents }: { events: CalendarEvent[] }) {
  const today    = new Date();
  const todayStr = toDateStr(today);

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selDay,    setSelDay]    = useState<string | null>(null);

  /* ── View toggle (calendar / map) ── */
  const [view, setView] = useState<'calendar' | 'map'>('calendar');

  /* ── Filters ── */
  const [filterCountry,    setFilterCountry]    = useState<string>('all');
  const [filterDiscipline, setFilterDiscipline] = useState<string>('all');
  const [filterLevel,      setFilterLevel]      = useState<string>('all');
  const [filterSearch,     setFilterSearch]     = useState<string>('');
  const [userLoc,          setUserLoc]          = useState<{ lat: number; lng: number } | null>(null);
  const [filterRadiusKm,   setFilterRadiusKm]   = useState<number>(0); // 0 = no radius filter

  /* ── Apply filters using native columns ── */
  const events = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return rawEvents.filter(e => {
      if (filterCountry !== 'all' && e.country_code !== filterCountry) return false;
      if (filterDiscipline !== 'all' && e.discipline !== filterDiscipline) return false;
      if (filterLevel !== 'all' && e.level !== filterLevel) return false;
      if (q) {
        const haystack = `${e.title} ${e.city || ''} ${e.country || ''} ${e.organizer || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (userLoc && filterRadiusKm > 0) {
        if (e.lat == null || e.lng == null) return false;
        const d = distanceKm(userLoc.lat, userLoc.lng, e.lat, e.lng);
        if (d > filterRadiusKm) return false;
      }
      return true;
    });
  }, [rawEvents, filterCountry, filterDiscipline, filterLevel, filterSearch, userLoc, filterRadiusKm]);

  /* ── Available levels in current selection (post discipline filter) ── */
  const availableLevels = useMemo(() => {
    const levelSet = new Set<string>();
    for (const e of rawEvents) {
      if (filterDiscipline !== 'all' && e.discipline !== filterDiscipline) continue;
      if (e.level) levelSet.add(e.level);
    }
    return Array.from(levelSet).sort();
  }, [rawEvents, filterDiscipline]);

  /* ── Auto-reset level filter if not in available list (es. cambio discipline) ── */
  useEffect(() => {
    if (filterLevel !== 'all' && !availableLevels.includes(filterLevel)) {
      setFilterLevel('all');
    }
  }, [availableLevels, filterLevel]);

  /* ── Build country list dynamically ── */
  const availableCountries = useMemo(() => {
    const codes = new Set<string>();
    for (const e of rawEvents) {
      if (e.country_code) codes.add(e.country_code);
    }
    return Array.from(codes).sort();
  }, [rawEvents]);

  /* ── Geolocation request ── */
  const requestGeo = () => {
    if (!navigator.geolocation) return alert('Geolocalizzazione non supportata');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (filterRadiusKm === 0) setFilterRadiusKm(100);
      },
      () => alert('Permesso geolocalizzazione negato'),
      { timeout: 10000 }
    );
  };

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

  /* ── Country flags helper ── */
  const flagEmoji = (cc?: string | null) => {
    if (!cc || cc.length !== 2) return '🌍';
    return String.fromCodePoint(...cc.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
  };

  const selectStyle: React.CSSProperties = {
    background: 'var(--gray-800)',
    color: 'var(--bone)',
    border: '1px solid var(--gray-700)',
    borderRadius: 6,
    padding: '6px 10px',
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    cursor: 'pointer',
  };

  return (
    <div>
      {/* ═══════════════════════════
          HERO — prossimo evento upcoming con countdown
      ═══════════════════════════ */}
      {(() => {
        const todayMid = new Date(); todayMid.setHours(0,0,0,0);
        const next = events
          .filter(e => {
            const d = new Date(dateOnly(e.event_date) + 'T00:00:00');
            return d.getTime() >= todayMid.getTime();
          })
          .sort((a, b) => dateOnly(a.event_date).localeCompare(dateOnly(b.event_date)))[0];
        if (!next) return null;

        const eventDate = new Date(dateOnly(next.event_date) + 'T12:00:00');
        const daysUntil = Math.round((eventDate.getTime() - todayMid.getTime()) / (1000 * 60 * 60 * 24));
        const flagEmoji = next.country_code && next.country_code.length === 2
          ? String.fromCodePoint(...next.country_code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
          : '🌍';

        const discColor = ({park:'#ff6b00',street:'#06b6d4',flatland:'#a855f7',race:'#10b981',dirt:'#a16207',mixed:'#facc15'} as Record<string,string>)[next.discipline || 'mixed'] || '#ff6b00';

        return (
          <div style={{
            position: 'relative',
            background: next.cover_url
              ? `linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.85) 100%), url(${next.cover_url}) center/cover`
              : `linear-gradient(135deg, ${discColor}22 0%, var(--gray-800) 100%)`,
            border: `1px solid ${discColor}`,
            borderRadius: 14,
            padding: '24px 22px',
            marginBottom: 16,
            overflow: 'hidden',
            minHeight: next.cover_url ? 240 : 'auto',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, color: discColor,
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
            }}>
              ⚡ Prossimo evento
            </div>
            <h2 style={{
              fontFamily: 'var(--font-mono)', fontSize: 22,
              color: '#fff', margin: '0 0 8px', lineHeight: 1.2,
              textShadow: next.cover_url ? '0 2px 8px rgba(0,0,0,0.8)' : 'none',
            }}>
              {next.title}
            </h2>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)',
              marginBottom: 14, opacity: 0.92,
              textShadow: next.cover_url ? '0 1px 4px rgba(0,0,0,0.8)' : 'none',
            }}>
              {flagEmoji} {[next.city, next.country].filter(Boolean).join(', ')}
              {next.discipline && <> • {({park:'🛹 Park',street:'🏙️ Street',flatland:'🌀 Flatland',race:'🏁 Race',mixed:'🎯 Mixed',dirt:'🏞️ Dirt'} as Record<string,string>)[next.discipline] || next.discipline}</>}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 38, color: discColor,
                  fontWeight: 700, lineHeight: 1, textShadow: '0 2px 8px rgba(0,0,0,0.6)',
                }}>
                  {daysUntil === 0 ? 'OGGI' : daysUntil === 1 ? 'DOMANI' : daysUntil}
                </div>
                {daysUntil > 1 && (
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-300)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2,
                  }}>
                    giorni
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-300)',
                  textShadow: next.cover_url ? '0 1px 4px rgba(0,0,0,0.8)' : 'none',
                }}>
                  📅 {eventDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <button
                  onClick={() => downloadICS(next)}
                  style={{
                    display: 'inline-block', marginTop: 8,
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    background: discColor, color: '#000',
                    padding: '6px 14px', borderRadius: 6,
                    border: 'none', cursor: 'pointer', fontWeight: 600,
                  }}>
                  📅 Aggiungi al calendario
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════
          VIEW TOGGLE
      ═══════════════════════════ */}
      <div style={{
        display: 'flex',
        background: 'var(--gray-800)',
        border: '1px solid var(--gray-700)',
        borderRadius: 10,
        padding: 4,
        marginBottom: 16,
        gap: 4,
      }}>
        {[
          { k: 'calendar' as const, label: '📅 Calendario' },
          { k: 'map'      as const, label: '🗺️ Mappa' },
        ].map(t => (
          <button
            key={t.k}
            onClick={() => setView(t.k)}
            style={{
              flex: 1,
              padding: '10px 12px',
              background: view === t.k ? 'var(--orange)' : 'transparent',
              color: view === t.k ? '#000' : 'var(--bone)',
              border: 'none',
              borderRadius: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: view === t.k ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════
          FILTRI
      ═══════════════════════════ */}
      <div style={{
        background: 'var(--gray-800)',
        border: '1px solid var(--gray-700)',
        borderRadius: 8,
        padding: 14,
        marginBottom: 16,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Filtri</span>

        {/* Search testuale */}
        <input
          type="text"
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          placeholder="🔍 Cerca evento, città, organizer..."
          style={{
            ...selectStyle,
            minWidth: 200,
            background: 'var(--gray-900)',
          }}
        />

        {/* Paese */}
        <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)} style={selectStyle}>
          <option value="all">🌍 Tutti i paesi</option>
          {availableCountries.map(cc => (
            <option key={cc} value={cc}>{flagEmoji(cc)} {cc}</option>
          ))}
        </select>

        {/* Disciplina */}
        <select value={filterDiscipline} onChange={e => setFilterDiscipline(e.target.value)} style={selectStyle}>
          <option value="all">🚴 Tutte discipline</option>
          <option value="park">🛹 Park</option>
          <option value="street">🏙️ Street</option>
          <option value="flatland">🌀 Flatland</option>
          <option value="race">🏁 Race</option>
          <option value="dirt">🏞️ Dirt</option>
          <option value="mixed">🎯 Mixed</option>
        </select>

        {/* Level / UCI Class — appare solo se ci sono level disponibili */}
        {availableLevels.length > 1 && (
          <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={selectStyle}>
            <option value="all">⚡ Tutti livelli</option>
            {availableLevels.includes('uci-wc')   && <option value="uci-wc">🏆 UCI World Cup</option>}
            {availableLevels.includes('uci-wch')  && <option value="uci-wch">🏆 World Champ</option>}
            {availableLevels.includes('uci-cc')   && <option value="uci-cc">🌍 Continental</option>}
            {availableLevels.includes('uci-c1')   && <option value="uci-c1">🥇 UCI C1</option>}
            {availableLevels.includes('uci-c2')   && <option value="uci-c2">🥈 UCI C2</option>}
            {availableLevels.includes('international') && <option value="international">🏅 Internazionale</option>}
            {availableLevels.includes('national') && <option value="national">🥇 Nazionale</option>}
            {availableLevels.includes('regional') && <option value="regional">🥈 Regionale</option>}
            {availableLevels.includes('local-jam') && <option value="local-jam">🎪 Local Jam</option>}
          </select>
        )}

        {/* Geolocalizzazione + km */}
        <button onClick={requestGeo} style={{ ...selectStyle, background: userLoc ? 'var(--orange)' : 'var(--gray-800)', color: userLoc ? 'var(--black)' : 'var(--bone)' }}>
          {userLoc ? '📍 Posizione attiva' : '📍 Usa posizione'}
        </button>

        {userLoc && (
          <select value={filterRadiusKm} onChange={e => setFilterRadiusKm(Number(e.target.value))} style={selectStyle}>
            <option value="0">∞ Mondo</option>
            <option value="50">50 km</option>
            <option value="100">100 km</option>
            <option value="250">250 km</option>
            <option value="500">500 km</option>
            <option value="1000">1.000 km</option>
            <option value="2500">2.500 km</option>
          </select>
        )}

        {/* Reset */}
        {(filterCountry !== 'all' || filterDiscipline !== 'all' || filterLevel !== 'all' || filterSearch || (userLoc && filterRadiusKm > 0)) && (
          <button
            onClick={() => { setFilterCountry('all'); setFilterDiscipline('all'); setFilterLevel('all'); setFilterSearch(''); setFilterRadiusKm(0); }}
            style={{ ...selectStyle, color: 'var(--orange)' }}
          >
            ✕ Reset
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>
          {events.length} di {rawEvents.length} eventi
        </span>
      </div>

      {/* ═══════════════════════════
          MAP VIEW
      ═══════════════════════════ */}
      {view === 'map' && (
        <div style={{ marginBottom: 28 }}>
          <EventsMap events={events} />
        </div>
      )}

      {/* ═══════════════════════════
          CALENDARIO
      ═══════════════════════════ */}
      {view === 'calendar' && (
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

            // Color map per discipline (Apple Calendar style)
            const discColor: Record<string,string> = {
              park: '#ff6b00',
              street: '#06b6d4',
              flatland: '#a855f7',
              race: '#10b981',
              dirt: '#a16207',
              mixed: '#facc15',
            };

            return (
              <div
                key={dStr}
                onClick={() => setSelDay(isSel ? null : dStr)}
                className="cal-cell"
                style={{
                  position: 'relative',
                  minHeight: 64,
                  padding: '6px 6px 4px 6px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  borderRadius: 10,
                  background: isSel
                    ? 'rgba(255,106,0,0.10)'
                    : 'transparent',
                  border: isSel
                    ? '1px solid var(--orange)'
                    : '1px solid transparent',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                {/* Numero giorno top-left */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  width: 24, height: 24,
                  borderRadius: '50%',
                  background: isToday ? 'var(--orange)' : 'transparent',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? '#000' : isPast ? 'var(--gray-500)' : 'var(--bone)',
                  marginBottom: 2,
                }}>
                  {day}
                </div>

                {/* Barre eventi colorate per discipline (max 3 visibili + counter) */}
                {hasEv && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 'auto' }}>
                    {evs.slice(0, 3).map((ev, j) => {
                      const color = discColor[ev.discipline || 'mixed'] || '#999';
                      return (
                        <div key={j} style={{
                          height: 4,
                          borderRadius: 2,
                          background: color,
                          opacity: isPast ? 0.35 : 0.9,
                        }} />
                      );
                    })}
                    {evs.length > 3 && (
                      <div style={{ fontSize: 9, color: 'var(--gray-500)', fontFamily: 'var(--font-mono)', textAlign: 'right', lineHeight: 1 }}>
                        +{evs.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}

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
        {/* Cover image — contain mode preserva flyer verticali integri */}
        <div style={{ width: '100%', aspectRatio: '4/5', background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
          <img
            className="event-poster-img"
            src={e.cover_url}
            alt={e.title}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            loading="lazy"
          />
        </div>

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
            <button
              onClick={() => downloadICS(e)}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                color: '#000', background: 'var(--orange)',
                padding: '8px 18px', borderRadius: 8,
                border: 'none', cursor: 'pointer',
              }}
              title="Aggiungi al tuo calendario (.ics)"
            >
              📅 Aggiungi al calendario
            </button>
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
              {e.country_code && <span style={{ marginRight: 6 }}>{String.fromCodePoint(...e.country_code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65))}</span>}
              📍 {[e.location, e.city, e.country].filter(Boolean).join(' — ')}
            </div>
          )}

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginBottom: 8 }}>
            🕐 {time}
          </div>

          {/* Tags chips: discipline + level + organizer */}
          {(e.discipline || e.level || e.organizer) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {e.discipline && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 8px',
                  background: 'rgba(255,106,0,0.15)', color: 'var(--orange)',
                  borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {({park:'🛹 Park',street:'🏙️ Street',flatland:'🌀 Flatland',race:'🏁 Race',mixed:'🎯 Mixed',dirt:'🏞️ Dirt'} as Record<string,string>)[e.discipline] || e.discipline}
                </span>
              )}
              {e.level && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 8px',
                  background: e.level.startsWith('uci-') ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.06)',
                  color: e.level.startsWith('uci-') ? '#ffd700' : 'var(--gray-300)',
                  borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {e.level === 'uci-wc' ? '🏆 UCI WC' : e.level === 'uci-c1' ? '🥇 UCI C1' : e.level === 'uci-c2' ? '🥈 UCI C2' : e.level.replace('-',' ')}
                </span>
              )}
              {e.organizer && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 8px',
                  background: 'rgba(255,255,255,0.04)', color: 'var(--gray-400)',
                  borderRadius: 4,
                }}>
                  🏛️ {e.organizer.length > 25 ? e.organizer.slice(0,23) + '…' : e.organizer}
                </span>
              )}
            </div>
          )}

          {e.description && (
            <p style={{ color: 'var(--bone)', fontSize: 13, lineHeight: 1.5, margin: '0 0 10px' }}>
              {e.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => downloadICS(e)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: '#000', background: 'var(--orange)', padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer' }}
              title="Aggiungi al tuo calendario (.ics)"
            >
              📅 Aggiungi al calendario
            </button>
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
        <div className="event-card-cover-wrap" style={{ aspectRatio: '4/5', overflow: 'hidden', position: 'relative', background: '#0a0a0a' }}>
          <img
            className="event-card-img"
            src={e.cover_url} alt={e.title}
            style={{ width: '100%', height: '100%', objectFit: 'contain', filter: past ? 'grayscale(0.5)' : 'none' }}
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
            {!past && (
              <button
                onClick={() => downloadICS(e)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: '#000', background: 'var(--orange)', padding: '5px 12px', borderRadius: 4, border: 'none', cursor: 'pointer' }}
                title="Aggiungi al tuo calendario (.ics)"
              >
                📅 Aggiungi al calendario
              </button>
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
