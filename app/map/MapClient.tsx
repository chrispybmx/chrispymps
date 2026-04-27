'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { SpotMapPin, SpotType, SpotCondition } from '@/lib/types';
import { REGIONI_ITALIA, TIPI_SPOT, CONDIZIONI } from '@/lib/constants';
import TopBar from '@/components/TopBar';
import AddSpotModal from '@/components/AddSpotModal';
import SupportModal from '@/components/SupportModal';
import AuthModal from '@/components/AuthModal';
// RadiusSheet sostituito da TopRadiusPanel inline

/* ── Haversine ── */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toR = (x: number) => x * Math.PI / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SpotMap = dynamic(() => import('@/components/SpotMap'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--gray-800)', fontFamily: 'var(--font-mono)',
      color: 'var(--orange)', fontSize: 16,
    }}>
      CARICAMENTO MAPPA...
    </div>
  ),
});

interface MapClientProps { initialSpots: SpotMapPin[]; autoAdd?: boolean }

const TOP_OFFSET = 100;

/* ════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════ */
export default function MapClient({ initialSpots, autoAdd }: MapClientProps) {
  const [spots]              = useState<SpotMapPin[]>(initialSpots);
  const [filterType,      setFilterType]      = useState<SpotType | null>(null);
  const [filterRegion,    setFilterRegion]    = useState<typeof REGIONI_ITALIA[0] | null>(null);
  const [filterCondition, setFilterCondition] = useState<SpotCondition | null>(null);
  const [filterDifficulty,setFilterDifficulty]= useState<string | null>(null);
  const [searchQuery,        setSearchQuery]        = useState('');
  const [addOpen,            setAddOpen]            = useState(false);
  const [supportOpen,        setSupportOpen]        = useState(false);
  const [addLat,             setAddLat]             = useState<number | undefined>();
  const [addLon,             setAddLon]             = useState<number | undefined>();
  const [flyTarget,          setFlyTarget]          = useState<{ lat: number; lon: number; zoom?: number } | null>(null);
  const [authOpen,           setAuthOpen]           = useState(false);
  const [fitAllTrigger,      setFitAllTrigger]      = useState(0);

  /* ── Auto-open add modal se URL contiene ?add=1 ── */
  useEffect(() => {
    if (autoAdd) setAddOpen(true);
  }, [autoAdd]);

  /* ── Pannello ridimensionabile ── */
  const PANEL_MIN  = 0;    // collassa completamente — il tab fisso rimane sempre visibile
  const PANEL_SNAP = 140;  // soglia sotto cui collassa
  const DEFAULT_PANEL_H = () =>
    typeof window !== 'undefined'
      ? Math.min(480, Math.max(270, window.innerHeight * 0.54))
      : 320;
  const [panelHeight,   setPanelHeight]   = useState<number>(320);
  const [panelSnapping, setPanelSnapping] = useState(false); // true durante animazione snap
  useEffect(() => { setPanelHeight(DEFAULT_PANEL_H()); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const dragState = useRef<{ startY: number; startH: number } | null>(null);

  const snapTo = useCallback((h: number) => {
    setPanelSnapping(true);
    setPanelHeight(h);
    setTimeout(() => setPanelSnapping(false), 260);
  }, []);

  const onDragStart = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { startY: e.clientY, startH: panelHeight };
  }, [panelHeight]);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return;
    const delta = dragState.current.startY - e.clientY;
    const newH  = Math.min(
      window.innerHeight * 0.88,
      Math.max(PANEL_MIN, dragState.current.startH + delta),
    );
    setPanelHeight(newH);
  }, [PANEL_MIN]);

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return;
    const h = dragState.current.startH + (dragState.current.startY - e.clientY);
    dragState.current = null;
    if (h < PANEL_SNAP)                     snapTo(PANEL_MIN);
    else if (h > window.innerHeight * 0.75) snapTo(Math.round(window.innerHeight * 0.88));
    // altrimenti rimane dov'è
  }, [PANEL_SNAP, snapTo]);

  /* ── Radius search ── dichiarati PRIMA di filtered che li usa ── */
  const [radiusMode,      setRadiusMode]      = useState(false);
  const [radiusPanelOpen, setRadiusPanelOpen] = useState(false);
  const [radiusCenter,    setRadiusCenter]    = useState<{ lat: number; lon: number } | null>(null);
  const [radiusKm,        setRadiusKm]        = useState(10);
  const [gpsLoading,      setGpsLoading]      = useState(false);
  const [citySearch,      setCitySearch]      = useState('');
  const [cityPickerOpen,  setCityPickerOpen]  = useState(false);
  const [cityResults,     setCityResults]     = useState<{ name: string; display: string; lat: number; lon: number }[]>([]);
  const [cityLoading,     setCityLoading]     = useState(false);

  /* Nominatim debounce per comuni italiani */
  useEffect(() => {
    if (!cityPickerOpen) return;
    if (citySearch.trim().length < 2) { setCityResults([]); return; }
    const t = setTimeout(async () => {
      setCityLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(citySearch)}&format=json&limit=8&countrycodes=it&accept-language=it&featuretype=city,town,village,municipality`;
        const res  = await fetch(url, { headers: { 'User-Agent': 'ChrispyMaps/1.0' } });
        const data = await res.json() as Array<{ name: string; display_name: string; lat: string; lon: string; type: string }>;
        setCityResults(data.map(r => ({
          name:    r.name || r.display_name.split(',')[0],
          display: r.display_name.split(',').slice(1, 3).join(',').trim(),
          lat:     parseFloat(r.lat),
          lon:     parseFloat(r.lon),
        })));
      } catch { setCityResults([]); }
      setCityLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [citySearch, cityPickerOpen]);

  /* ── Bottoni mappa: locate trigger ── */
  const [locateTrigger, setLocateTrigger] = useState(0);
  const [isLocating,    setIsLocating]    = useState(false);

  /* ── Auto-hide bottoni mappa ── */
  /* I bottoni si nascondono quando il pannello è alto (> 62% vh) o il raggio è aperto.
     Toccando il bordo sinistro si rivelano per 4 secondi. */
  const [btnsRevealed,  setBtnsRevealed] = useState(false);
  const btnsRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealButtons = useCallback(() => {
    if (btnsRevealTimerRef.current) clearTimeout(btnsRevealTimerRef.current);
    setBtnsRevealed(true);
    btnsRevealTimerRef.current = setTimeout(() => setBtnsRevealed(false), 4000);
  }, []);
  useEffect(() => () => {
    if (btnsRevealTimerRef.current) clearTimeout(btnsRevealTimerRef.current);
  }, []);

  /* ── Stile mappa (chiaro/scuro) ── */
  const [darkMap, setDarkMap] = useState<boolean>(() => {
    try { return localStorage.getItem('cmaps_dark_map') === '1'; } catch { return false; }
  });
  const toggleDarkMap = () => setDarkMap(prev => {
    const next = !prev;
    try { localStorage.setItem('cmaps_dark_map', next ? '1' : '0'); } catch { /* */ }
    return next;
  });

  /* ── Spot attivo (bordo + mappa) e spot espanso (contenuto) — separati ── */
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  /* Auto-espandi il pannello quando si apre una card */
  useEffect(() => {
    if (expandedId) {
      const minH = Math.min(Math.round(window.innerHeight * 0.72), 580);
      setPanelHeight(h => h < minH ? minH : h);
    }
  }, [expandedId]);
  const [scrollToId,   setScrollToId]   = useState<string | null>(null);
  /* flag: cambiamento viene dallo scroll (IO) → non ri-flyare */
  const fromScrollRef = useRef(false);

  const filtered = useMemo(() => {
    let result = spots.filter((s) => {
      if (filterType && s.type !== filterType) return false;
      if (filterRegion) {
        const [latMin, lonMin, latMax, lonMax] = filterRegion.bbox;
        if (s.lat < latMin || s.lat > latMax || s.lon < lonMin || s.lon > lonMax) return false;
      }
      if (filterCondition && s.condition !== filterCondition) return false;
      if (filterDifficulty && s.difficulty !== filterDifficulty) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase().replace(/^@/, '');
        return (
          s.name.toLowerCase().includes(q) ||
          (s.city ?? '').toLowerCase().includes(q) ||
          (s.submitted_by_username ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
    // Quando il raggio è attivo E il pannello è chiuso (confermato) → filtra per distanza
    if (radiusMode && radiusCenter && !radiusPanelOpen) {
      result = result
        .filter(s => haversineKm(radiusCenter.lat, radiusCenter.lon, s.lat, s.lon) <= radiusKm)
        .sort((a, b) =>
          haversineKm(radiusCenter.lat, radiusCenter.lon, a.lat, a.lon) -
          haversineKm(radiusCenter.lat, radiusCenter.lon, b.lat, b.lon)
        );
    }
    return result;
  }, [spots, filterType, filterRegion, filterCondition, filterDifficulty, searchQuery, radiusMode, radiusCenter, radiusPanelOpen, radiusKm]);

  /* Pin selezionato sulla mappa (marker ingrandito + orange outline) */
  const selectedPin = useMemo(() =>
    filtered.find(s => s.id === activeListId) ?? null,
  [filtered, activeListId]);

  /* Auto-refit mappa quando cambiano i filtri principali.
     Usiamo un ref per saltare il primo render (mount). */
  const filterInitRef = useRef(false);
  useEffect(() => {
    if (!filterInitRef.current) { filterInitRef.current = true; return; }
    // Incrementa il trigger → SpotMap farà fitBounds sui filtered
    setFitAllTrigger(n => n + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterRegion, filterCondition, filterDifficulty, searchQuery]);

  const handleFilterRegion = useCallback((label: string | null) => {
    if (!label) { setFilterRegion(null); return; }
    const region = REGIONI_ITALIA.find(r => r.label === label) ?? null;
    setFilterRegion(region);
    // NON setFlyTarget: il fitAllTrigger (useEffect su filterRegion) farà fitBounds
    // sugli spot reali della regione → zoom calibrato sui dati, non sul centro bbox
  }, []);

  const spotsInRadius = useMemo(() => {
    if (!radiusCenter) return [];
    return spots
      .map(s => ({ ...s, distance: haversineKm(radiusCenter.lat, radiusCenter.lon, s.lat, s.lon) }))
      .filter(s => s.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }, [spots, radiusCenter, radiusKm]);

  // Il click sulla mappa NON imposta più il centro del raggio —
  // il centro si sceglie solo tramite GPS o selezione città nel pannello
  const handleMapClick = useCallback((lat: number, lon: number) => {
    /* intenzionalmente vuoto: radius center viene da GPS o city picker */
    void lat; void lon;
  }, []);

  const handleUseGPS = useCallback(() => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const center = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setRadiusCenter(center);
        setFlyTarget({ lat: center.lat, lon: center.lon, zoom: 11 });
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const closeRadiusMode = useCallback(() => {
    setRadiusMode(false);
    setRadiusCenter(null);
    setRadiusPanelOpen(false);
    setCitySearch('');
    setCityPickerOpen(false);
  }, []);

  const handleCityForRadius = useCallback((cityLabel: string, lat: number, lon: number) => {
    const center = { lat, lon };
    setRadiusCenter(center);
    setFlyTarget({ lat, lon, zoom: 11 });
    setCitySearch(cityLabel);
    setCityPickerOpen(false);
  }, []);

  const handleRadiusToggle = useCallback(() => {
    if (radiusMode) {
      closeRadiusMode();
    } else {
      setRadiusMode(true);
      setRadiusPanelOpen(true);
    }
  }, [radiusMode, closeRadiusMode]);

  const handleApplyRadius = useCallback(() => {
    setRadiusPanelOpen(false);
    // La mappa mostra già il cerchio, la lista già filtra via spotsInRadius
  }, []);

  /* Click su uno spot (da mappa o da lista) → espandi card + vola mappa
     Zoom 13: mostra il quartiere/zona, non solo il singolo marciapiede,
     così l'utente capisce subito dove si trova lo spot nel contesto urbano. */
  /* Lock temporaneo: impedisce all'IntersectionObserver di sovrascrivere
     l'activeListId subito dopo la chiusura di una card (il collasso cambia
     le altezze e il IO si riattiverebbe sullo spot sbagliato). */
  const ioLockRef = useRef(false);

  const handleSpotClick = useCallback((pin: SpotMapPin) => {
    setActiveListId(pin.id);
    setExpandedId(prev => {
      const isClosing = prev === pin.id;
      if (isClosing) {
        /* Chiusura: non scrollare (la card è già visibile) e blocca il IO
           per 300 ms così il bordo arancione rimane sullo spot chiuso. */
        ioLockRef.current = true;
        setTimeout(() => { ioLockRef.current = false; }, 300);
      } else {
        /* Apertura: scroll dopo l'espansione */
        setTimeout(() => setScrollToId(pin.id), 260);
      }
      return isClosing ? null : pin.id;
    });
    setFlyTarget({ lat: pin.lat, lon: pin.lon, zoom: 13 });
  }, []);

  /* Scroll sync: IO ha visto una card → aggiorna SOLO il pin attivo (bordo arancione)
     ma NON muove la mappa. Debounce 120ms: il bordo si aggiorna solo quando
     lo scroll si ferma, evitando salti durante il movimento. */
  const activateDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleActivateFromScroll = useCallback((id: string) => {
    if (ioLockRef.current) return; // lock attivo — ignora
    if (activateDebounce.current) clearTimeout(activateDebounce.current);
    activateDebounce.current = setTimeout(() => {
      fromScrollRef.current = true;
      setActiveListId(id);
    }, 120);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCitySelect = useCallback((city: string, lat: number, lon: number) => {
    setFlyTarget({ lat, lon, zoom: 14 });
    setSearchQuery(city);
  }, []);

  const handleAddSpotAt = useCallback((lat: number, lon: number) => {
    setAddLat(lat); setAddLon(lon); setAddOpen(true);
  }, []);

  return (
    <div style={{ height: '100dvh', overflow: 'hidden' }}>

      <TopBar
        onSearch={setSearchQuery}
        onFilterType={setFilterType}
        onFilterRegion={handleFilterRegion}
        onFilterCondition={setFilterCondition}
        onFilterDifficulty={setFilterDifficulty}
        onAddSpot={() => setAddOpen(true)}
        activeType={filterType}
        activeRegion={filterRegion?.label ?? null}
        activeCondition={filterCondition}
        activeDifficulty={filterDifficulty}
        spots={spots}
        filteredCount={filtered.length}
        onCitySelect={handleCitySelect}
        onSpotSelect={handleSpotClick}
        onOpenAuth={() => setAuthOpen(true)}
        darkMap={darkMap}
        onToggleDarkMap={toggleDarkMap}
      />

      {/* ── MAPPA — schermo intero sotto topbar ── */}
      <div style={{
        position: 'fixed',
        top: TOP_OFFSET, left: 0, right: 0, bottom: 0,
        zIndex: 1,
      }}>
        <SpotMap
          spots={spots}
          filterType={filterType}
          filterRegionBbox={filterRegion?.bbox ?? null}
          searchQuery={searchQuery}
          onSpotClick={handleSpotClick}
          onAddSpotAt={handleAddSpotAt}
          flyTarget={flyTarget}
          selectedPin={selectedPin}
          overlayOffsetPx={Math.round(panelHeight / 2)}
          fitAllTrigger={fitAllTrigger}
          radiusMode={radiusMode}
          radiusCenter={radiusCenter}
          radiusKm={radiusKm}
          onMapClick={handleMapClick}
          locateTrigger={locateTrigger}
          onLocatingChange={setIsLocating}
          darkMap={darkMap}
        />
        {/* Toast solo quando raggio attivo e nessun centro ancora */}
        {/* RadiusToast rimosso: il centro si sceglie solo da GPS o città nel pannello */}
      </div>

      {/* ── BOTTONI MAPPA — colonna sinistra, auto-hide ── */}
      {(() => {
        const windowH = typeof window !== 'undefined' ? window.innerHeight : 700;
        // Nascondi quando il pannello è alto (>62% vh) o il raggio è aperto
        const autoHidden = panelHeight > windowH * 0.62 || radiusPanelOpen;
        const showBtns   = !autoHidden || btnsRevealed;
        return (
          <>
            {/* Colonna bottoni con slide-in/out */}
            <div style={{
              position: 'fixed',
              top: TOP_OFFSET + 10,
              left: 12,
              display: 'flex', flexDirection: 'column', gap: 8,
              zIndex: 55,
              opacity:   showBtns ? 1 : 0,
              transform: showBtns ? 'translateX(0)' : 'translateX(-56px)',
              pointerEvents: showBtns ? 'all' : 'none',
              transition: 'opacity 0.22s ease, transform 0.22s ease',
            }}>
              {/* Localizza me */}
              <MapBtn
                onClick={() => setLocateTrigger(n => n + 1)}
                disabled={isLocating}
                title="Mostrami sulla mappa"
                active={false}
                loading={isLocating}
              >
                {isLocating ? '⌛' : '📍'}
              </MapBtn>

              {/* Ricerca per raggio */}
              <MapBtn
                onClick={handleRadiusToggle}
                title="Ricerca per raggio"
                active={radiusMode}
              >
                🎯
              </MapBtn>

              {/* Toggle mappa chiara/scura */}
              <MapBtn
                onClick={toggleDarkMap}
                title={darkMap ? 'Mappa chiara' : 'Mappa scura'}
                active={darkMap}
              >
                {darkMap ? '🌞' : '🌑'}
              </MapBtn>

            </div>

            {/* Bordo sinistro — tap per rivelare i bottoni quando sono nascosti */}
            {autoHidden && !btnsRevealed && (
              <div
                onClick={revealButtons}
                style={{
                  position: 'fixed',
                  top: TOP_OFFSET + 10,
                  left: 0,
                  width: 18,
                  height: 132,
                  zIndex: 54,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                }}
              >
                <div style={{
                  width: 4, height: 72,
                  background: 'rgba(255,106,0,0.35)',
                  borderRadius: '0 4px 4px 0',
                  transition: 'background 0.15s',
                }} />
              </div>
            )}
          </>
        );
      })()}

      {/* ── PANNELLO RAGGIO — scende dall'alto quando attivo ── */}
      {radiusMode && radiusPanelOpen && (
        <div style={{
          position: 'fixed',
          top: TOP_OFFSET,
          left: 0, right: 0,
          zIndex: 50,
          background: 'rgba(14,14,14,0.97)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '2px solid var(--orange)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
          padding: '14px 16px 16px',
        } as React.CSSProperties}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 22 }}>🎯</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--orange)', lineHeight: 1 }}>
                RICERCA PER RAGGIO
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginTop: 3 }}>
                {radiusCenter
                  ? `${spotsInRadius.length} spot nel raggio di ${radiusKm} km`
                  : 'Scegli il centro con GPS o città'}
              </div>
            </div>
            <button onClick={closeRadiusMode} style={{
              background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
              borderRadius: 6, width: 32, height: 32, fontSize: 16,
              color: 'var(--bone)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>

          {/* GPS + CITTÀ — due bottoni affiancati */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button
              onClick={handleUseGPS} disabled={gpsLoading}
              style={{
                flex: 1, padding: '10px 10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.4)',
                borderRadius: 8, cursor: gpsLoading ? 'default' : 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orange)',
                opacity: gpsLoading ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: 16 }}>{gpsLoading ? '⌛' : '📡'}</span>
              {gpsLoading ? 'GPS...' : 'MIA POSIZIONE'}
            </button>
            <button
              onClick={() => setCityPickerOpen(v => !v)}
              style={{
                flex: 1, padding: '10px 10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: cityPickerOpen ? 'rgba(255,106,0,0.15)' : 'rgba(255,106,0,0.05)',
                border: `1px solid ${cityPickerOpen ? 'var(--orange)' : 'rgba(255,106,0,0.3)'}`,
                borderRadius: 8, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orange)',
              }}
            >
              <span style={{ fontSize: 16 }}>🏙️</span>
              {citySearch || 'SCEGLI CITTÀ'}
            </button>
          </div>

          {/* City picker — input + lista comuni via Nominatim */}
          {cityPickerOpen && (
            <div style={{
              marginBottom: 10,
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid var(--gray-600)',
              borderRadius: 8, overflow: 'hidden',
            }}>
              <div style={{ position: 'relative' }}>
                <input
                  autoFocus
                  value={citySearch}
                  onChange={e => setCitySearch(e.target.value)}
                  placeholder="Cerca comune..."
                  style={{
                    width: '100%', padding: '9px 36px 9px 12px',
                    background: 'var(--gray-800)', border: 'none', borderBottom: '1px solid var(--gray-700)',
                    fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
                {cityLoading && (
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>...</span>
                )}
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {/* Risultati Nominatim */}
                {cityResults.length > 0 && cityResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => handleCityForRadius(r.name, r.lat, r.lon)}
                    style={{
                      width: '100%', padding: '9px 12px', textAlign: 'left',
                      background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                      fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)',
                      cursor: 'pointer', display: 'block',
                    }}
                  >
                    {r.name}
                    {r.display && <span style={{ color: 'var(--gray-500)', fontSize: 10, marginLeft: 6 }}>{r.display}</span>}
                  </button>
                ))}
                {/* Stato vuoto */}
                {!cityLoading && citySearch.trim().length >= 2 && cityResults.length === 0 && (
                  <div style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-500)', textAlign: 'center' }}>
                    Nessun comune trovato
                  </div>
                )}
                {citySearch.trim().length < 2 && (
                  <div style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)' }}>
                    Digita almeno 2 lettere...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chips raggio */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', flexShrink: 0 }}>
              KM:
            </span>
            {[10, 25, 50, 100, 200, 500].map(km => (
              <button key={km} onClick={() => setRadiusKm(km)} style={{
                flex: 1, padding: '6px 0',
                fontFamily: 'var(--font-mono)', fontSize: 11,
                border: `1px solid ${radiusKm === km ? 'var(--orange)' : 'var(--gray-600)'}`,
                borderRadius: 6,
                background: radiusKm === km ? 'var(--orange)' : 'transparent',
                color: radiusKm === km ? '#000' : 'var(--gray-400)',
                cursor: 'pointer', fontWeight: radiusKm === km ? 700 : 400,
                transition: 'all 0.1s',
              }}>
                {km}
              </button>
            ))}
          </div>

          {/* APPLICA */}
          <button
            onClick={handleApplyRadius}
            disabled={!radiusCenter}
            style={{
              width: '100%', padding: '12px',
              background: radiusCenter ? 'var(--orange)' : 'var(--gray-700)',
              border: 'none', borderRadius: 8,
              fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700,
              color: radiusCenter ? '#000' : 'var(--gray-500)',
              cursor: radiusCenter ? 'pointer' : 'default',
              letterSpacing: '0.05em',
              transition: 'all 0.15s',
            }}
          >
            {radiusCenter
              ? `✓ APPLICA — ${spotsInRadius.length} SPOT`
              : '↑ SCEGLI GPS O CITTÀ'}
          </button>
        </div>
      )}

      {/* Banner raggio attivo (pannello chiuso) */}
      {radiusMode && !radiusPanelOpen && radiusCenter && (
        <div style={{
          position: 'fixed',
          top: TOP_OFFSET + 8,
          left: 60,
          zIndex: 55,
          background: 'rgba(255,106,0,0.15)',
          border: '1px solid var(--orange)',
          borderRadius: 6,
          padding: '5px 10px',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 2px 14px rgba(0,0,0,0.6)',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orange)' }}>
            🎯 {radiusKm}km · {filtered.length} spot
          </span>
          <button
            onClick={closeRadiusMode}
            style={{
              background: 'none', border: 'none',
              color: 'var(--orange)', cursor: 'pointer', fontSize: 14,
              padding: '0 2px', lineHeight: 1,
            }}
          >✕</button>
        </div>
      )}

      {/* ── TAB FISSO — sempre visibile, toggle su/giù ── */}
      <div
        onClick={() => {
          if (panelHeight <= PANEL_MIN + 10) snapTo(DEFAULT_PANEL_H());
          else snapTo(PANEL_MIN);
        }}
        style={{
          position: 'fixed',
          bottom: 0, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 11,
          padding: '8px 20px 12px',
          background: 'rgba(10,10,10,0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '12px 12px 0 0',
          border: '1px solid rgba(255,255,255,0.07)',
          borderBottom: 'none',
          display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer',
          pointerEvents: 'all',
          userSelect: 'none',
        }}
      >
        <span style={{
          fontSize: 15,
          display: 'inline-block',
          transition: 'transform 0.25s ease',
          transform: panelHeight <= PANEL_MIN + 10 ? 'rotate(0deg)' : 'rotate(180deg)',
        }}>↑</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 13,
          color: 'var(--orange)', letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          {filtered.length} spot
        </span>
      </div>

      {/* ── OVERLAY LISTA — galleggia sulla mappa, altezza regolabile ── */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 10,
        height: panelHeight,
        display: 'flex', flexDirection: 'column',
        pointerEvents: 'none',
        transition: (dragState.current && !panelSnapping) ? 'none' : 'height 0.25s cubic-bezier(0.34,1.2,0.64,1)',
      }}>
        {/* Gradiente fade */}
        <div style={{
          height: 36, flexShrink: 0,
          background: 'linear-gradient(to bottom, transparent 0%, rgba(10,10,10,0.97) 100%)',
          pointerEvents: 'none',
          marginBottom: -1,
        }} />

        {/* ── DRAG HANDLE + PANNELLO — unico layer blur/background ── */}
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          background: 'rgba(10,10,10,0.97)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          pointerEvents: 'all',
          overflow: 'hidden',
          borderRadius: panelHeight <= PANEL_MIN + 10 ? '14px 14px 0 0' : '0',
          transition: 'border-radius 0.25s ease',
        }}>

          {/* ── DRAG HANDLE ── */}
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            style={{
              flexShrink: 0,
              height: 46,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'ns-resize',
              touchAction: 'none',
            }}
          >
            <div style={{
              width: 68, height: 26,
              background: '#222',
              borderRadius: 5,
              boxShadow: 'inset 0 1px 0 #3e3e3e, inset 0 -1px 0 #111, 0 3px 8px rgba(0,0,0,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', position: 'relative',
            } as React.CSSProperties}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 3px)',
                pointerEvents: 'none',
              }} />
              <div style={{ display: 'flex', gap: 3, position: 'relative' }}>
                {[0,1,2,3,4].map(col => (
                  <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ width: 4, height: 4, background: '#3a3a3a', borderRadius: '50%', boxShadow: 'inset -1px -1px 0 #222, inset 1px 1px 0 #505050' }} />
                    <div style={{ width: 4, height: 4, background: '#3a3a3a', borderRadius: '50%', boxShadow: 'inset -1px -1px 0 #222, inset 1px 1px 0 #505050' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pannello scroll */}
          {panelHeight > 90 && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <SpotListPanel
                spots={filtered}
                activeId={activeListId}
                expandedId={expandedId}
                onActivate={handleActivateFromScroll}
                onSpotClick={handleSpotClick}
                scrollToId={scrollToId}
                onScrolled={() => setScrollToId(null)}
                radiusCenter={radiusMode && !radiusPanelOpen ? radiusCenter : null}
              />
            </div>
          )}
        </div>
      </div>

      <AddSpotModal
        open={addOpen}
        onClose={() => { setAddOpen(false); setAddLat(undefined); setAddLon(undefined); }}
        initialLat={addLat} initialLon={addLon}
      />
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   SPOT LIST PANEL
════════════════════════════════════════════════════════ */

const FAVS_KEY  = 'cmaps_favs_v1';
const ratingKey = (id: string) => `cmaps_rating_${id}`;

function isFav(id: string) {
  try { return (JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]') as string[]).includes(id); }
  catch { return false; }
}
function toggleFav(id: string) {
  try {
    const favs: string[] = JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]');
    const i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.push(id);
    localStorage.setItem(FAVS_KEY, JSON.stringify(favs));
    return i < 0;
  } catch { return false; }
}
function getMyRating(id: string): number {
  try { return Math.min(5, Math.max(0, parseInt(localStorage.getItem(ratingKey(id)) ?? '0', 10) || 0)); }
  catch { return 0; }
}

function SpotListPanel({
  spots, activeId, expandedId, onActivate, onSpotClick, scrollToId, onScrolled, radiusCenter,
}: {
  spots:        SpotMapPin[];
  activeId:     string | null;
  expandedId:   string | null;
  onActivate:   (id: string) => void;
  onSpotClick:  (pin: SpotMapPin) => void;
  scrollToId:   string | null;
  onScrolled:   () => void;
  radiusCenter: { lat: number; lon: number } | null;
}) {
  const [favs,       setFavs]       = useState<Record<string, boolean>>({});
  const [ratings,    setRatings]    = useState<Record<string, number>>({});
  /* Indice foto corrente per ogni spot (nella card espansa) */
  const [photoIdx,   setPhotoIdx]   = useState<Record<string, number>>({});
  /* Lightbox: { urls, idx } */
  const [lightbox,   setLightbox]   = useState<{ urls: string[]; idx: number } | null>(null);
  /* Refs strip foto per scroll-snap (una per ogni spot espanso) */
  const photoStripRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  /* Swipe-vs-tap detection per la strip foto (shared: una sola card espansa per volta) */
  const photoTouchStartX = useRef(0);
  const photoTouchStartY = useRef(0);
  const photoIsSwiping   = useRef(false);

  const panelRef       = useRef<HTMLDivElement>(null);
  const cardRefs       = useRef<Map<string, Element>>(new Map());
  const ioRef          = useRef<IntersectionObserver | null>(null);
  /* Mappa dei ratio di visibilità: id → intersectionRatio (0..1) */
  const visibilityMap  = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const f: Record<string, boolean> = {};
    const r: Record<string, number>  = {};
    spots.forEach(s => { f[s.id] = isFav(s.id); r[s.id] = getMyRating(s.id); });
    setFavs(f); setRatings(r);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots.length]);

  /* IntersectionObserver con root = pannello scroll.
     Strategia: aggiorna la mappa di visibilità ad ogni entry, poi scegli
     sempre lo spot con il ratio PIÙ ALTO — evita salti durante lo scroll. */
  useEffect(() => {
    ioRef.current?.disconnect();
    visibilityMap.current.clear();
    if (!panelRef.current) return;
    ioRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const id = (entry.target as HTMLElement).dataset.spotId;
          if (!id) return;
          if (entry.isIntersecting) {
            visibilityMap.current.set(id, entry.intersectionRatio);
          } else {
            visibilityMap.current.delete(id);
          }
        });
        /* Spot più visibile nella viewport */
        let bestId = '';
        let bestRatio = -1;
        visibilityMap.current.forEach((ratio, id) => {
          if (ratio > bestRatio) { bestRatio = ratio; bestId = id; }
        });
        if (bestId) onActivate(bestId);
      },
      {
        root: panelRef.current,
        rootMargin: '-5% 0px -50% 0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
      }
    );
    cardRefs.current.forEach(el => ioRef.current!.observe(el));
    return () => ioRef.current?.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots]);

  const setRef = useCallback((id: string, el: Element | null) => {
    if (el) { cardRefs.current.set(id, el); ioRef.current?.observe(el); }
    else    { cardRefs.current.delete(id); }
  }, []);

  useEffect(() => {
    if (!scrollToId || !panelRef.current) return;
    const el = cardRefs.current.get(scrollToId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    onScrolled();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToId]);

  const handleFav = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const added = toggleFav(id);
    setFavs(prev => ({ ...prev, [id]: added }));
  };

  /* ── Non-passive touchmove sulla strip foto ──────────────────────────────
     Safari iOS ignora touch-action: pan-x dentro overflow-y: auto.
     L'unico fix affidabile è preventDefault() in un listener non-passivo
     quando il gesto è orizzontale — impossibile farlo con i synthetic events
     di React (sempre passivi). Lo montiamo/smontiamo via useEffect. */
  useEffect(() => {
    if (!expandedId) return;
    let removeListeners: (() => void) | undefined;

    /* Piccolo delay: React deve aver già renderizzato la card espansa
       prima che possiamo leggere il ref della strip. */
    const t = setTimeout(() => {
      const stripEl = photoStripRefs.current.get(expandedId);
      if (!stripEl) return;

      let startX = 0, startY = 0, decided = false;

      const onStart = (e: TouchEvent) => {
        startX  = e.touches[0].clientX;
        startY  = e.touches[0].clientY;
        decided = false;
      };
      const onMove = (e: TouchEvent) => {
        const dx = Math.abs(e.touches[0].clientX - startX);
        const dy = Math.abs(e.touches[0].clientY - startY);
        if (!decided && (dx > 4 || dy > 4)) decided = true;
        /* Gesto orizzontale → blocca lo scroll verticale del parent */
        if (decided && dx > dy) e.preventDefault();
      };

      stripEl.addEventListener('touchstart', onStart, { passive: true });
      stripEl.addEventListener('touchmove',  onMove,  { passive: false });

      removeListeners = () => {
        stripEl.removeEventListener('touchstart', onStart);
        stripEl.removeEventListener('touchmove',  onMove);
      };
    }, 30);

    return () => { clearTimeout(t); removeListeners?.(); };
  }, [expandedId]);

  /* Naviga le foto della card espansa via scroll-snap */
  const scrollToPhotoInStrip = useCallback((spotId: string, i: number) => {
    const el = photoStripRefs.current.get(spotId);
    if (!el) return;
    el.scrollTo({ left: i * el.offsetWidth, behavior: 'smooth' });
    setPhotoIdx(p => ({ ...p, [spotId]: i }));
  }, []);

  /* Chiude lightbox con Escape */
  useEffect(() => {
    if (!lightbox) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') setLightbox(l => l ? { ...l, idx: l.idx === l.urls.length - 1 ? 0 : l.idx + 1 } : l);
      if (e.key === 'ArrowLeft')  setLightbox(l => l ? { ...l, idx: l.idx === 0 ? l.urls.length - 1 : l.idx - 1 } : l);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [lightbox]);

  if (spots.length === 0) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--gray-500)', fontSize: 14 }}>
        Nessuno spot trovato.<br />
        <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>Prova a cambiare filtro.</span>
      </div>
    );
  }

  return (
    <>
    {/* ── LIGHTBOX ── */}
    {lightbox && (
      <div
        onClick={() => setLightbox(null)}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.96)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* Close */}
        <button onClick={() => setLightbox(null)} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
          width: 44, height: 44, fontSize: 22, color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
        }}>✕</button>

        {/* Prev */}
        {lightbox.idx > 0 && (
          <button onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, idx: l.idx - 1 } : l); }}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 48, height: 48, fontSize: 26, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        )}

        {/* Image */}
        <img
          src={lightbox.urls[lightbox.idx]}
          alt=""
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 4, boxShadow: '0 8px 48px rgba(0,0,0,0.8)' }}
        />

        {/* Next */}
        {lightbox.idx < lightbox.urls.length - 1 && (
          <button onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, idx: l.idx + 1 } : l); }}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 48, height: 48, fontSize: 26, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        )}

        {/* Counter */}
        {lightbox.urls.length > 1 && (
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            {lightbox.idx + 1} / {lightbox.urls.length}
          </div>
        )}
      </div>
    )}

    <div ref={panelRef} style={{ height: '100%', overflowY: 'auto', overscrollBehavior: 'contain' } as React.CSSProperties}>

      <style>{`
        .spot-card-wrap { -webkit-tap-highlight-color: transparent; }
        @media (hover: hover) and (pointer: fine) {
          .spot-card-wrap:not([data-exp="1"]):hover { background: rgba(255,255,255,0.025) !important; }
        }
        .spot-card-wrap:active { opacity: 0.9; }
        .spot-fav-btn { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        .photo-nav-btn { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        .thumb-btn { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
      `}</style>

      {/* Header lista — nascosto quando una card è espansa (coprirebbe la X) */}
      {!expandedId && (
        <div style={{
          padding: '7px 14px 5px',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em',
          borderBottom: radiusCenter ? '1px solid rgba(255,106,0,0.2)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0,
          background: 'rgba(10,10,10,0.97)', zIndex: 2,
        }}>
          <span>{spots.length} spot</span>
          {radiusCenter && (
            <span style={{ color: 'var(--orange)', fontSize: 10 }}>
              🎯 per distanza
            </span>
          )}
        </div>
      )}

      {spots.map((spot, idx) => {
        const tipo      = TIPI_SPOT[spot.type];
        const cond      = CONDIZIONI[spot.condition];
        const isAct     = activeId   === spot.id;
        const isExp     = expandedId === spot.id;
        const myFav     = favs[spot.id]    ?? false;
        const isLast    = idx === spots.length - 1;
        const featured  = !expandedId && idx < 3;

        /* Foto disponibili */
        const allPhotos = spot.photo_urls && spot.photo_urls.length > 0
          ? spot.photo_urls
          : spot.cover_url ? [spot.cover_url] : [];
        const curPhotoIdx = photoIdx[spot.id] ?? 0;
        const curPhoto    = allPhotos[curPhotoIdx];

        const goPrev = (e: React.MouseEvent) => {
          e.stopPropagation();
          setPhotoIdx(p => {
            const cur = p[spot.id] ?? 0;
            return { ...p, [spot.id]: cur === 0 ? allPhotos.length - 1 : cur - 1 };
          });
        };
        const goNext = (e: React.MouseEvent) => {
          e.stopPropagation();
          setPhotoIdx(p => {
            const cur = p[spot.id] ?? 0;
            return { ...p, [spot.id]: cur === allPhotos.length - 1 ? 0 : cur + 1 };
          });
        };

        return (
          <div
            key={spot.id}
            ref={(el) => setRef(spot.id, el)}
            data-spot-id={spot.id}
            data-exp={isExp ? '1' : undefined}
            className="spot-card-wrap"
            onClick={() => onSpotClick(spot)}
            style={{
              position: 'relative',
              borderBottom: (isLast || isAct) ? 'none' : '1px solid rgba(255,255,255,0.06)',
              borderLeft: `3px solid ${isAct ? 'var(--orange)' : featured ? 'rgba(255,106,0,0.22)' : 'transparent'}`,
              transition: 'border-color 0.25s, background 0.15s',
              cursor: 'pointer',
              background: isExp ? 'rgba(255,106,0,0.04)' : featured ? 'rgba(255,106,0,0.01)' : 'transparent',
              touchAction: isExp ? 'auto' : 'manipulation',
            }}
          >

            {/* ══ EXPANDED LAYOUT ══ */}
            {isExp ? (
              <div style={{ position: 'relative' }}>

                {/* Header row: X chiudi — sticky, sempre visibile, mai sul gradiente */}
                <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', justifyContent: 'flex-end', padding: '6px 8px 2px', background: 'rgba(10,10,10,0.97)' }}>
                  <button
                    onClick={e => { e.stopPropagation(); onSpotClick(spot); }}
                    style={{
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
                      borderRadius: '50%', width: 28, height: 28,
                      fontSize: 13, color: 'var(--bone)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                    }}
                    aria-label="Chiudi"
                  >✕</button>
                </div>

                {/* ── FOTO — scroll-snap swipeable ── */}
                {allPhotos.length > 0 ? (
                  <div style={{ position: 'relative', background: '#0a0a0a' }}>
                    {/* Scroll-snap strip — stesso schema di PhotoCarousel */}
                    <div
                      ref={(el) => {
                        if (el) photoStripRefs.current.set(spot.id, el);
                        else photoStripRefs.current.delete(spot.id);
                      }}
                      onScroll={e => {
                        const el = e.currentTarget;
                        const newIdx = Math.round(el.scrollLeft / el.offsetWidth);
                        setPhotoIdx(p => p[spot.id] !== newIdx ? { ...p, [spot.id]: newIdx } : p);
                      }}
                      onTouchStart={e => {
                        photoTouchStartX.current = e.touches[0].clientX;
                        photoTouchStartY.current = e.touches[0].clientY;
                        photoIsSwiping.current   = false;
                      }}
                      onTouchMove={e => {
                        const dx = Math.abs(e.touches[0].clientX - photoTouchStartX.current);
                        const dy = Math.abs(e.touches[0].clientY - photoTouchStartY.current);
                        if (dx > 6 || dy > 6) photoIsSwiping.current = true;
                        /* Se il gesto è orizzontale blocca la card dal ricevere il touch */
                        if (dx > dy) e.stopPropagation();
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        if (!photoIsSwiping.current) setLightbox({ urls: allPhotos, idx: curPhotoIdx });
                      }}
                      style={{
                        display: 'flex',
                        overflowX: 'auto',
                        scrollSnapType: 'x mandatory',
                        scrollBehavior: 'auto',
                        WebkitOverflowScrolling: 'touch',
                        scrollbarWidth: 'none',
                        width: '100%',
                        height: 200,
                        cursor: 'zoom-in',
                        touchAction: 'pan-x',
                      } as React.CSSProperties}
                    >
                      {allPhotos.map((url, i) => (
                        <div
                          key={url + i}
                          style={{
                            flexShrink: 0,
                            width: '100%',
                            height: '100%',
                            scrollSnapAlign: 'start',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: '#0a0a0a',
                          }}
                        >
                          <img
                            src={url}
                            alt={spot.name}
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
                            loading={i === 0 ? 'eager' : 'lazy'}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Frecce — circolari centrate come PhotoCarousel */}
                    {allPhotos.length > 1 && (
                      <>
                        <button onClick={e => { e.stopPropagation(); scrollToPhotoInStrip(spot.id, curPhotoIdx === 0 ? allPhotos.length - 1 : curPhotoIdx - 1); }} className="photo-nav-btn"
                          style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.62)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)', borderRadius: '50%', width: 36, height: 36, color: '#fff', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, padding: 0, fontFamily: 'serif', lineHeight: 1 }}>‹</button>
                        <button onClick={e => { e.stopPropagation(); scrollToPhotoInStrip(spot.id, (curPhotoIdx + 1) % allPhotos.length); }} className="photo-nav-btn"
                          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.62)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)', borderRadius: '50%', width: 36, height: 36, color: '#fff', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, padding: 0, fontFamily: 'serif', lineHeight: 1 }}>›</button>
                      </>
                    )}

                    {/* Zoom hint */}
                    <div style={{ position: 'absolute', bottom: 6, right: 8, background: 'rgba(0,0,0,0.55)', borderRadius: 4, padding: '2px 5px', fontSize: 11, pointerEvents: 'none', color: '#fff' }}>🔍</div>

                    {/* Dots */}
                    {allPhotos.length > 1 && (
                      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, pointerEvents: 'none' }}>
                        {allPhotos.map((_, i) => (
                          <div key={i}
                            style={{ width: i === curPhotoIdx ? 14 : 5, height: 5, borderRadius: 3, background: i === curPhotoIdx ? 'var(--orange)' : 'rgba(255,255,255,0.35)', transition: 'width 0.2s' }} />
                        ))}
                      </div>
                    )}

                    <button onClick={e => handleFav(e, spot.id)} className="spot-fav-btn"
                      style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 4, width: 30, height: 30, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {myFav ? '❤️' : '🤍'}
                    </button>
                  </div>
                ) : (
                  /* Nessuna foto — placeholder con emoji + cuore */
                  <div style={{ height: 52, background: 'var(--gray-800)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10 }}>
                    <span style={{ fontSize: 28, opacity: 0.25 }}>{tipo.emoji}</span>
                    <button onClick={e => handleFav(e, spot.id)} className="spot-fav-btn"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: myFav ? 16 : 13, opacity: myFav ? 1 : 0.4, marginLeft: 'auto' }}>
                      {myFav ? '❤️' : '🤍'}
                    </button>
                  </div>
                )}

                {/* Thumbnail strip */}
                {allPhotos.length > 1 && (
                  <div style={{ display: 'flex', gap: 4, padding: '6px 10px', background: '#0a0a0a', overflowX: 'auto', scrollbarWidth: 'none' } as React.CSSProperties}>
                    {allPhotos.map((url, i) => (
                      <button key={i} className="thumb-btn" onClick={e => { e.stopPropagation(); scrollToPhotoInStrip(spot.id, i); }}
                        style={{ flexShrink: 0, width: 52, height: 40, border: `2px solid ${i === curPhotoIdx ? 'var(--orange)' : 'transparent'}`, borderRadius: 3, overflow: 'hidden', padding: 0, cursor: 'pointer', background: '#111' }}>
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Info testo — compatto */}
                <div style={{ padding: '10px 12px 12px', background: '#0a0a0a' }}>
                  {/* Nome + badges in una riga */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
                    <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--orange)', lineHeight: 1.2 }}>
                      {spot.name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 5 }}>
                    {spot.condition === 'alive' ? (
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#00c851', boxShadow: '0 0 5px #00c851aa' }} />
                    ) : (
                      <span style={{ background: cond.bg, color: cond.color, fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase' }}>{cond.label}</span>
                    )}
                    <span style={{ color: tipo.color, fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 5px', borderRadius: 2, border: `1px solid ${tipo.color}55`, textTransform: 'uppercase' }}>{tipo.emoji} {tipo.label}</span>
                    {spot.difficulty && <span style={{ color: '#ffce4d', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 5px', borderRadius: 2, border: '1px solid rgba(255,206,77,0.3)', textTransform: 'uppercase' }}>⚡ {spot.difficulty}</span>}
                  </div>

                  {(spot.city || spot.submitted_by_username) && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', marginBottom: 8 }}>
                      {spot.city && <span>📍 {spot.city}</span>}
                      {spot.submitted_by_username && <span style={{ color: 'var(--gray-600)' }}> · @{spot.submitted_by_username}</span>}
                    </div>
                  )}

                  {/* Azioni compatte */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Link
                      href={`/map/spot/${spot.slug}`}
                      onClick={e => e.stopPropagation()}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#000', background: 'var(--orange)', border: 'none', borderRadius: 4, padding: '8px 0', textDecoration: 'none', letterSpacing: '0.04em' }}
                    >
                      VEDI SPOT →
                    </Link>
                    <button
                      onClick={e => { e.stopPropagation(); window.open(`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lon}`, '_blank'); }}
                      title="Portami qui"
                      style={{ width: 36, height: 36, background: 'rgba(255,106,0,0.1)', border: '1px solid rgba(255,106,0,0.35)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}
                    >📍</button>
                  </div>
                </div>
              </div>

            ) : (
              /* ══ COMPACT LAYOUT ══ */
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px' }}>
                {/* Thumbnail più grande */}
                <div style={{ flexShrink: 0, width: 116, height: 116, borderRadius: 6, overflow: 'hidden', background: 'var(--gray-700)', border: isAct ? '2px solid var(--orange)' : '1px solid rgba(255,255,255,0.07)' }}>
                  {spot.cover_url ? (
                    <img src={spot.cover_url} alt={spot.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, opacity: 0.3 }}>{tipo.emoji}</div>
                  )}
                </div>

                {/* Testo */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: isAct ? 'var(--orange)' : 'var(--bone)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                      {spot.name}
                    </div>
                    <button onClick={e => handleFav(e, spot.id)} className="spot-fav-btn" style={{ flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: myFav ? 16 : 13, opacity: myFav ? 1 : 0.4 }}>
                      {myFav ? '❤️' : '🤍'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    {spot.condition === 'alive' ? (
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#00c851', boxShadow: '0 0 5px #00c851aa' }} />
                    ) : (
                      <span style={{ background: cond.bg, color: cond.color, fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase' }}>{cond.label}</span>
                    )}
                    <span style={{ color: tipo.color, fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 5px', borderRadius: 2, border: `1px solid ${tipo.color}55`, textTransform: 'uppercase' }}>{tipo.label}</span>
                  </div>
                  {(spot.city || spot.submitted_by_username) && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[spot.city, spot.submitted_by_username ? `@${spot.submitted_by_username}` : null].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 📍 Directions — appare quando lo spot è attivo e non espanso */}
            {isAct && !isExp && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 10px 8px' }}>
                <button
                  onClick={e => { e.stopPropagation(); window.open(`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lon}`, '_blank'); }}
                  title="Portami qui"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--orange)', background: 'rgba(255,106,0,0.1)', border: '1px solid rgba(255,106,0,0.3)', borderRadius: 4, padding: '4px 9px', cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
                >
                  <span style={{ fontSize: 13 }}>📍</span> Portami qui
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div style={{ height: 'calc(48px + env(safe-area-inset-bottom, 0px))' }} />
    </div>
    </>
  );
}

/* ── Bottone mappa generico ── */
function MapBtn({
  children, onClick, title, active = false, disabled = false, loading = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 40, height: 40,
        background: active ? 'var(--orange)' : 'var(--gray-800)',
        border: `1px solid ${active ? 'var(--orange)' : 'var(--gray-600)'}`,
        borderRadius: 6,
        color: active ? '#000' : loading ? 'var(--orange)' : 'var(--bone)',
        fontSize: 18, cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 14px rgba(0,0,0,0.6)',
        animation: loading ? 'spin-slow 1s linear infinite' : 'none',
        flexShrink: 0,
      } as React.CSSProperties}
    >
      {children}
    </button>
  );
}

function RadiusToast() {
  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      background: 'rgba(10,10,10,0.92)', border: '1px solid var(--orange)',
      borderRadius: 8, padding: '10px 18px',
      fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--orange)',
      zIndex: 20, whiteSpace: 'nowrap', pointerEvents: 'none',
      boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
    }}>
      🎯 Tocca la mappa per scegliere il centro
    </div>
  );
}
