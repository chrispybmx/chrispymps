import type { Metadata } from 'next';
import { JAM_ROMA } from '@/lib/jamroma';
import JamRomaClient from './JamRomaClient';

export const metadata: Metadata = {
  title: `${JAM_ROMA.title} — ${JAM_ROMA.subtitle} | Chrispy Maps`,
  description: `${JAM_ROMA.title}: ${JAM_ROMA.subtitle}. ${JAM_ROMA.dateLabel}, ${JAM_ROMA.locationLabel}. Mappa live, spot e partecipanti.`,
  openGraph: {
    title: `${JAM_ROMA.title} — ${JAM_ROMA.subtitle}`,
    description: `${JAM_ROMA.dateLabel} · ${JAM_ROMA.locationLabel}`,
    images: [{ url: JAM_ROMA.posterUrl, width: 800, height: 1000 }],
  },
};

export default function JamRomaPage() {
  return <JamRomaClient />;
}
