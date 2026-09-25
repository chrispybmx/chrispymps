'use client';
import { useLanguage } from './LanguageProvider';
export default function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return <div role="group" aria-label="Lingua / Language" style={{display:'inline-flex',gap:4}}>
    {(['it','en'] as const).map(value => <button key={value} type="button" lang={value} aria-label={value === 'it' ? 'Italiano' : 'English'} aria-pressed={language === value} onClick={() => setLanguage(value)} style={{minWidth:44,minHeight:44,border:'1px solid var(--gray-600)',borderRadius:3,background:language === value?'var(--bone)':'transparent',color:language === value?'var(--black)':'var(--bone)',font:'600 14px system-ui',cursor:'pointer'}}>{value.toUpperCase()}</button>)}
  </div>;
}
