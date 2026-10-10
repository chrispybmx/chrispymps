"use client";
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import BottomNav from '@/components/BottomNav';
import { requestSignIn } from '@/lib/auth-navigation';
import styles from './scopri.module.css';
export default function ScopriLoading() {
  const { text } = useLanguage();
  return <main className={styles.page}><header className={styles.header}><div className={styles.brandRow}><Link href="/" className={styles.brand}>Chrispy <span>Maps</span></Link><Link href="/" className={styles.mapLink}>{text('Mappa', 'Map')}</Link></div><h1>{text('Scopri spot', 'Discover spots')}</h1></header><div className={styles.results} role="status" aria-live="polite"><p style={{ padding: 24 }}>{text('Caricamento degli spot…', 'Loading spots…')}</p></div><BottomNav onOpenAuth={requestSignIn} /></main>;
}
