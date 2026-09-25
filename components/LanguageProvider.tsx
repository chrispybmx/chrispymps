'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { languageLocale, parseLanguage, type SiteLanguage } from '@/lib/language';

const Context = createContext({ language: 'it' as SiteLanguage, locale: 'it-IT', text: (it: string, _en: string) => it, setLanguage: (_language: SiteLanguage) => {} });
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, update] = useState<SiteLanguage>('it');
  const router = useRouter();
  useEffect(() => {
    const cookie = document.cookie.split('; ').find(value => value.startsWith('cm_language='))?.split('=')[1];
    update(parseLanguage(cookie));
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const setLanguage = useCallback((next: SiteLanguage) => {
    update(next);
    document.cookie = `cm_language=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    router.refresh();
  }, [router]);
  const value = useMemo(() => ({ language, locale: languageLocale(language), text: (it: string, en: string) => language === 'en' ? en : it, setLanguage }), [language, setLanguage]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useLanguage = () => useContext(Context);
