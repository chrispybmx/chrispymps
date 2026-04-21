'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import type { SpotMapPin, SpotType, Spot } from '@/lib/types';
import TopBar from '@/components/TopBar';
import SpotSheet from '@/components/SpotSheet';
import AddSpotModal from '@/components/AddSpotModal';
import SupportModal from '@/components/SupportModal';
import DiscoverStrip from '@/components/DiscoverStrip';

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
        />
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

      {/* Discover strip — suggerisce spot a caso */}
      {!selectedSpot && (
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
    </div>
  );
}
