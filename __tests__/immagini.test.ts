import { describe, it, expect } from 'vitest';
import { miniatura } from '@/lib/immagini';

const VERA = 'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/abc/0.jpg';

/**
 * La regola che conta qui non e' «ridimensiona bene»: e' «non rompere mai una
 * card». Una miniatura sbagliata su una griglia di spot significa riquadri
 * vuoti al posto delle foto, che e' peggio di una foto pesante.
 *
 * Quindi tutto cio' che non e' riconosciuto passa INVARIATO.
 */
describe('miniatura — non deve mai rompere una card', () => {
  it('trasforma una foto del nostro storage', () => {
    const m = miniatura(VERA, 400)!;
    expect(m).toContain('/storage/v1/render/image/public/');
    expect(m).toContain('width=400');
    expect(m).not.toContain('/object/public/');
  });

  it('lascia stare un indirizzo di un altro sito', () => {
    const altrove = 'https://example.com/foto.jpg';
    expect(miniatura(altrove, 400)).toBe(altrove);
  });

  it('lascia stare un indirizzo che non riconosce', () => {
    const strano = 'data:image/png;base64,iVBORw0KGgo=';
    expect(miniatura(strano, 400)).toBe(strano);
  });

  it('su valori vuoti restituisce undefined, non una stringa rotta', () => {
    expect(miniatura(undefined, 400)).toBeUndefined();
    expect(miniatura(null, 400)).toBeUndefined();
    expect(miniatura('', 400)).toBeUndefined();
  });

  it('non tocca il percorso del file', () => {
    /* Se cambiasse il percorso, la foto non si troverebbe piu'. */
    expect(miniatura(VERA, 200)).toContain('spot-photos/abc/0.jpg');
  });

  it('larghezze diverse danno indirizzi diversi', () => {
    expect(miniatura(VERA, 200)).not.toBe(miniatura(VERA, 400));
  });
});
