import { cookies } from 'next/headers';
import { parseLanguage } from './language';
export function getSiteLanguage() { return parseLanguage(cookies().get('cm_language')?.value); }
