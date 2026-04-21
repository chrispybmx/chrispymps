'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useMemo } from 'react';
import type { SpotMapPin, SpotType, Spot } from '@/lib/types';
import TopBar from '@/components/TopBar';
import SpotSheet from '@/components/SpotSheet';
import AddSpotModal from '@/components/AddSpotModal';
import SupportModal from '@/components/SupportModal';
import DiscoverStrip from '@/components/DiscoverStrip';
import AuthModal from '@/components/AuthModal';
import RadiusSheet from '@/components/RadiusSheet';

/* ── Haversine distance in km ── */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toR = (x: number) => x * Math.PI / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SpotMap = dynamic(() => import('@/components/SpotMap'), {
  ssr: false,
  loading: () => (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--gray-800)', fontFamily: 'var(--font-mono)',
      color: 'var(--orange)', fontSize: 18, animation: 'flicker 4s infinite',
    }}>
      CARICAMENTO MAPPA...
    </div>
  ),
});

interface MapClientProps {
  initialSpots: SpotMapPin[];
}

export default function MapClient({ initialSpots }: MapClientProps) {
  const [spots]         = useState<SpotMapPin[]>(initialSpots);
  const [filterType,    setFilterType]    = useState<SpotType | null>(null);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [selectedSpot,  setSelectedSpot]  = useState<Spot | null>(null);
  const [addOpen,       setAddOpen]       = useState(false);
  const [supportOpen,   setSupportOpen]   = useState(false);
  const [addLat,        setAddLat]        = useState<number | undefined>();
  const [addLon,        setAddLon]        = useState<number | undefined>();
  const [loadingSpot,   setLoadingSpot]   = useState(false);
  const [flyTarget,     setFlyTarget]     = useState<{ lat: number; lon: number; zoom?: number } | null>(null);
  const [authOpen,      setAuthOpen]      = useState(false);

  /* ── Radius search ── */
  const [radiusMode,   setRadiusMode]   = useState(false);
  const [radiusCenter, setRadiusCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [radiusKm,     setRadiusKm]     = useState(50);
  const [gpsLoading,   setGpsLoading]   = useState(false);

  const spotsInRadius = useMemo(() => {
    if (!radiusCenter) return [];
    return spots
      .map(s => ({ ...s, distance: haversineKm(radiusCenter.lat, radiusCenter.lon, s.lat, s.lon) }))
      .filter(s => s.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }, [spots, radiusCenter, radiusKm]);

  const handleMapClick = useCallback((lat: number, lon: number) => {
    if (radiusMode) setRadiusCenter({ lat, lon });
  }, [radiusMode]);

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
      () => { setGpsLoading(false); alert('Impossibile ottenere la posizione GPS.'); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const closeRadiusMode = useCallback(() => {
    setRadiusMode(false);
    setRadiusCenter(null);
  }, []);

  // Click su un pin o su un suggerimento della ricerca
  const openSpot = useCallback(async (pin: SpotMapPin) => {
    setLoadingSpot(true);
    // Fly to spot first
    setFlyTarget({ lat: pin.lat, lon: pin.lon, zoom: 16 });
    try {
      const res = await fetch(`/api/spots/${pin.slug}`);
      if (res.ok) {
        const json = await res.json();
        setSelectedSpot(json.data);
      } else {
        setSelectedSpot(pin as unknown as Spot);
      }
    } catch {
      setSelectedSpot(pin as unknown as Spot);
    } finally {
      setLoadingSpot(false);
    }
  }, []);

  // Selezione città dalla ricerca → vola sulla mappa
  const handleCitySelect = useCallback((city: string, lat: number, lon: number) => {
    setFlyTarget({ lat, lon, zoom: 14 });
    setSearchQuery(city);
  }, []);

  const handleAddSpotAt = useCallback((lat: number, lon: number) => {
    setAddLat(lat); setAddLon(lon); setAddOpen(true);
  }, []);

  const handleFlag = useCallback(async (spotId: string) => {
    const reason = window.prompt('Perché segnali questo spot?');
    if (!reason) return;
    await fetch('/api/flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spot_id: spotId, reason }),
    });
    alert('Segnalazione inviata. Grazie!');
  }, []);

  const topOffset = 100; // topbar 56 + filtri 44

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <TopBar
        onSearch={setSearchQuery}
        onFilterType={setFilterType}
        onAddSpot={() => setAddOpen(true)}
        activeType={filterType}
        spots={spots}
        onCitySelect={handleCitySelect}
        onSpotSelect={openSpot}
        onOpenAuth={() => setAuthOpen(true)}
      />

      {/* Mappa a tutto schermo */}
      <div style={{
        position: 'fixed',
        top: topOffset, left: 0, right: 0,
        bottom: 'var(--strip-height)',
        zIndex: 1,
      }}>
        <SpotMap
          spots={spots}
          filterType={filterType}
          searchQuery={searchQuery}
          onSpotClick={openSpot}
          onAddSpotAt={handleAddSpotAt}
          flyTarget={flyTarget}
          radiusMode={radiusMode}
          radiusCenter={radiusCenter}
          radiusKm={radiusKm}
          onMapClick={handleMapClick}
        />

        {/* ── Bottone toggle raggio (bottom-left) ── */}
        <button
          onClick={() => {
            if (radiusMode) { closeRadiusMode(); }
            else { setRadiusMode(true); }
          }}
          title="Ricerca per raggio"
          style={{
            position: 'absolute',
            bottom: 'calc(var(--strip-height, 48px) + 16px + env(safe-area-inset-bottom))',
            left: 16,
            width: 44, height: 44,
            background: radiusMode ? 'var(--orange)' : 'var(--gray-800)',
            border: `1px solid ${radiusMode ? 'var(--orange)' : 'var(--gray-600)'}`,
            borderRadius: 4,
            color: radiusMode ? '#000' : 'var(--bone)',
            fontSize: 22, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
            zIndex: 10,
          }}
        >
          🎯
        </button>

        {/* ── Toast "tap mappa" quando non c'è ancora il centro ── */}
        {radiusMode && !radiusCenter && (
          <div style={{
            position: 'absolute',
            top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(10,10,10,0.9)',
            border: '1px solid var(--orange)',
            borderRadius: 8,
            padding: '8px 16px',
            fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--orange)',
            zIndex: 20, whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            🎯 Tocca la mappa per centrare la ricerca
          </div>
        )}

      </div>

      {/* Loading overlay */}
      {loadingSpot && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(var(--strip-height) + 16px)',
          left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,10,10,0.9)',
          color: 'var(--orange)', fontFamily: 'var(--font-mono)',
          fontSize: 14, padding: '8px 16px',
          borderRadius: 4, zIndex: 46,
          border: '1px solid var(--gray-600)',
        }}>
          CARICAMENTO...
        </div>
      )}

      {/* Radius sheet (sostituisce DiscoverStrip in modalità raggio) */}
      {radiusMode && (
        <RadiusSheet
          radiusKm={radiusKm}
          center={radiusCenter}
          spots={spotsInRadius}
          onSetRadius={setRadiusKm}
          onUseGPS={handleUseGPS}
          onClose={closeRadiusMode}
          onSpotClick={openSpot}
          gpsLoading={gpsLoading}
        />
      )}

      {/* Discover strip — suggerisce spot a caso */}
      {!selectedSpot && !radiusMode && (
        <DiscoverStrip
          spots={spots}
          onSpotClick={openSpot}
        />
      )}

      {/* Scheda spot */}
      <SpotSheet
        spot={selectedSpot}
        onClose={() => setSelectedSpot(null)}
        onFlag={handleFlag}
      />

      {/* Modal aggiungi spot */}
      <AddSpotModal
        open={addOpen}
        onClose={() => { setAddOpen(false); setAddLat(undefined); setAddLon(undefined); }}
        initialLat={addLat}
        initialLon={addLon}
      />

      {/* Modal supporto */}
      <SupportModal
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
      />

      {/* Auth modal (da SideMenu o altri trigger) */}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
      />
    </div>
  );
}
