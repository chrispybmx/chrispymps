import { cookies } from 'next/headers';
import { parseLanguage } from './language';
export async function getSiteLanguage() { return parseLanguage((await cookies()).get('cm_language')?.value); }
