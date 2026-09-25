import type { Metadata } from 'next';
import { Suspense } from 'react';
import MessagesClient from './MessagesClient';
import './messages.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Messaggi',
  description: 'Inviti personali a una session e conversazioni tra rider.',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  alternates: { canonical: null },
};

export default function MessagesPage() {
  return <Suspense fallback={<main className="cm-messages"><p role="status">Caricamento messaggi…</p></main>}><MessagesClient /></Suspense>;
}
