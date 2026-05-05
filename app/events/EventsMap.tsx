'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { CalendarEvent } from './EventsCalendar';

let L: typeof import('leaflet') | null = null;

const DISCIPLINE_COLOR: Record<string, string> = {
  park:     '#ff6b00',
  street:   '#06b6d4',
  flatland: '#a855f7',
  race:     '#10b981',
  dirt:     '#a16207',
  mixed:    '#facc15',
};

const DISCIPLINE_EMOJI: Record<string, string> = {
  park:     '🛹',
  street:   '🏙️',
  flatland: '🌀',
  race:     '🏁',
  dirt:     '🏞️',
  mixed:    '🎯',
};

const LEVEL_LABEL: Record<string, string> = {
  'uci-wc':  '🏆 UCI WC',
  'uci-c1':  '🥇 UCI C1',
  'uci-c2':  '🥈 UCI C2',
  'uci-cc':  '🌍 Continental',
  'uci-wch': '🏆 World Champ',
  'national': 'Nazionale',
  'regional': 'Regionale',
  'local-jam': 'Local Jam',
  'international': 'Internazionale',
};

function pinSvg(discipline: string): string {
  const color = DISCIPLINE_COLOR[discipline] || '#999';
  const emoji = DISCIPLINE_EMOJI[discipline] || '📍';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 30 38">
    <path d="M15 0C6.72 0 0 6.72 0 15c0 8.28 15 23 15 23S30 23.28 30 15C30 6.72 23.28 0 15 0z"
          fill="${color}" stroke="#0a0a0a" stroke-width="1.5"/>
    <circle cx="15" cy="15" r="9" fill="rgba(0,0,0,0.22)"/>
    <text x="15" y="15.5" text-anchor="middle" font-size="11" dominant-baseline="middle">${emoji}</text>
  </svg>`;
}

export default function EventsMap({ events }: { events: CalendarEvent[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<import('leaflet').Marker[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!L) {
        L = (await import('leaflet')).default;
        // Fix Leaflet default icon paths in Next.js
        delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      }
      if (cancelled || !mapRef.current) return;

      // Init map se non già creato
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current, {
          center: [45, 10],
          zoom: 4,
          zoomControl: true,
          attributionControl: true,
        });

        // Dark tile layer (CartoDB Dark Matter)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OSM &copy; CartoDB',
          maxZoom: 19,
          subdomains: 'abcd',
        }).addTo(mapInstanceRef.current);
      }

      // Clear existing markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      // Add markers
      const validEvents = events.filter(e => e.lat != null && e.lng != null);
      const bounds: [number, number][] = [];

      for (const ev of validEvents) {
        const icon = L.divIcon({
          html: pinSvg(ev.discipline || 'mixed'),
          className: 'event-pin',
          iconSize: [32, 40],
          iconAnchor: [16, 38],
          popupAnchor: [0, -36],
        });

        const date = new Date(ev.event_date).toLocaleDateString('it-IT', {
          day: 'numeric', month: 'short', year: 'numeric',
        });
        const dateEnd = ev.date_end && ev.date_end !== ev.event_date
          ? ' → ' + new Date(ev.date_end).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
          : '';

        const flagEmoji = ev.country_code && ev.country_code.length === 2
          ? String.fromCodePoint(...ev.country_code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
          : '';

        const popup = `
          <div style="min-width:200px;font-family:-apple-system,sans-serif">
            <div style="font-weight:600;font-size:14px;margin-bottom:6px;line-height:1.3">${ev.title}</div>
            <div style="font-size:12px;color:#666;margin-bottom:4px">
              ${flagEmoji} ${ev.city || ''} ${ev.country ? '— ' + ev.country : ''}
            </div>
            <div style="font-size:12px;color:#666;margin-bottom:8px">📅 ${date}${dateEnd}</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
              ${ev.discipline ? `<span style="font-size:10px;padding:2px 6px;background:${DISCIPLINE_COLOR[ev.discipline]||'#999'}22;color:${DISCIPLINE_COLOR[ev.discipline]||'#999'};border-radius:3px;text-transform:uppercase">${DISCIPLINE_EMOJI[ev.discipline]||''} ${ev.discipline}</span>` : ''}
              ${ev.level ? `<span style="font-size:10px;padding:2px 6px;background:#facc1522;color:#a16207;border-radius:3px">${LEVEL_LABEL[ev.level] || ev.level}</span>` : ''}
            </div>
            ${ev.link_url ? `<a href="${ev.link_url}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:#ff6b00;text-decoration:none;font-weight:500">Info & Iscrizioni →</a>` : ''}
          </div>
        `;

        const marker = L.marker([ev.lat!, ev.lng!], { icon })
          .addTo(mapInstanceRef.current!)
          .bindPopup(popup, { maxWidth: 280 });

        markersRef.current.push(marker);
        bounds.push([ev.lat!, ev.lng!]);
      }

      // Fit bounds to markers
      if (bounds.length > 0) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
      }
    })();

    return () => { cancelled = true; };
  }, [events]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const validCount = events.filter(e => e.lat != null && e.lng != null).length;
  const noGeoCount = events.length - validCount;

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '60vh',
          minHeight: 400,
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid var(--gray-700)',
        }}
      />
      {/* Legenda colori */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        background: 'rgba(10,10,10,0.92)',
        border: '1px solid var(--gray-700)',
        borderRadius: 8,
        padding: '8px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--bone)',
        zIndex: 500,
      }}>
        <div style={{ marginBottom: 4, fontSize: 9, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Discipline</div>
        {Object.entries(DISCIPLINE_COLOR).map(([k, color]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, background: color, borderRadius: '50%' }} />
            <span>{DISCIPLINE_EMOJI[k]} {k}</span>
          </div>
        ))}
      </div>
      {noGeoCount > 0 && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(10,10,10,0.92)', border: '1px solid var(--gray-700)',
          borderRadius: 6, padding: '6px 10px',
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)',
          zIndex: 500,
        }}>
          {validCount}/{events.length} mappati
        </div>
      )}
    </div>
  );
}
