/**
 * Converte una stringa in slug URL-safe.
 * Gestisce caratteri italiani (àèéìòù), spazi, caratteri speciali.
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Genera lo slug per uno spot: nome + città + 6 char dell'id UUID.
 * Esempio: "piazza-bra-verona-3f2a1c"
 */
export function spotSlug(name: string, city: string | undefined, id: string): string {
  const namePart = slugify(name);
  const cityPart = city ? slugify(city) : 'italy';
  const idPart   = id.replace(/-/g, '').slice(0, 6);
  return `${namePart}-${cityPart}-${idPart}`;
}

/**
 * Normalizza il nome di una città per il routing.
 * "Reggio Calabria" → "reggio-calabria"
 */
export function citySlug(city: string): string {
  return city
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const CITY_SLUG_RE = /^[a-z0-9-]{1,60}$/;
