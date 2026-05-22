'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import BottomNav from '@/components/BottomNav';
import AuthModal from '@/components/AuthModal';

const AddSpotModal = dynamic(() => import('@/components/AddSpotModal'), { ssr: false });

export default function SpotPageShell() {
  const [addOpen, setAddOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <>
      <AddSpotModal open={addOpen} onClose={() => setAddOpen(false)} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <BottomNav
        onAddSpot={() => setAddOpen(true)}
        onOpenAuth={() => setAuthOpen(true)}
      />
    </>
  );
}
