import type { Metadata } from 'next';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import PrivacySettings from '@/components/PrivacySettings';
import styles from '@/components/PrivacySettings.module.css';

export const metadata: Metadata = {
  title: 'Privacy e dati',
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function PrivacySettingsPage() {
  return <main className={styles.page}>
    <Link href="/map">Torna alla mappa</Link>
    <h1>Privacy e dati</h1>
    <PrivacySettings />
    <BottomNav />
  </main>;
}
