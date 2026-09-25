'use client';
import { useLanguage } from '@/components/LanguageProvider';
import styles from './scopri.module.css';

export default function ScopriLoading() {
  const { text } = useLanguage();
  return <main className={styles.loading} role="status" aria-live="polite"><h1>{text('Scopri spot', 'Discover spots')}</h1><span className={styles.loadingLine} aria-hidden="true" /><p>{text('Caricamento degli spot…', 'Loading spots…')}</p></main>;
}
