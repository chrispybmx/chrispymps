/* Gli username ammettono '_', che in ILIKE vale "un carattere qualsiasi":
   'bmx_rider' trovava anche 'bmxArider'. Si fa l'escape per avere un
   confronto esatto, solo senza distinzione maiuscole/minuscole. */
export function exactIlikePattern(value: string): string {
  return value.replace(/[\\%_*]/g, ch => `\\${ch}`);
}
