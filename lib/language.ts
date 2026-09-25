export type SiteLanguage = 'it' | 'en';
export function parseLanguage(value: unknown): SiteLanguage { return value === 'en' ? 'en' : 'it'; }
export const languageLocale = (language: SiteLanguage) => language === 'en' ? 'en-GB' : 'it-IT';
