'use client';

import { useEffect, useMemo, useState } from 'react';

interface Props {
  /** 'YYYY-MM-DD' oppure '' se incompleta. */
  value: string;
  onChange: (iso: string) => void;
  /** Anno più vecchio proposto. */
  annoMin?: number;
  id?: string;
}

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/** Giorni del mese, con gli anni bisestili contati bene. */
function giorniDelMese(anno: number, mese: number): number {
  if (!anno || !mese) return 31;
  return new Date(anno, mese, 0).getDate();
}

const selStyle: React.CSSProperties = {
  flex: 1, minWidth: 0,
  background: 'var(--gray-700)',
  border: '1px solid var(--gray-600)',
  borderRadius: 6,
  color: 'var(--bone)',
  fontSize: 15,
  padding: '11px 8px',
  fontFamily: 'inherit',
  outline: 'none',
  appearance: 'none',
  WebkitAppearance: 'none',
};

/**
 * Data a tre rondelle: giorno, mese, anno.
 *
 * Perché tre `select` e non un `input type="date"`: su iOS e Android un select
 * si apre come rullo nativo, quindi non si digita niente e non esistono date
 * scritte male. Un date picker classico, per una data di nascita, parte da oggi
 * e costringe a scorrere indietro vent'anni.
 *
 * I giorni si adattano al mese scelto, anni bisestili compresi: il 31 febbraio
 * non è selezionabile, non "accettato e poi rifiutato".
 */
export default function DateWheels({ value, onChange, annoMin = 1950, id }: Props) {
  /* Stato interno per le tre rondelle.
     Serve perché una data si compone un pezzo alla volta: derivando tutto da
     `value` (che è vuoto finché la data non è completa) la prima scelta
     verrebbe scartata al primo render e il campo non si riuscirebbe a
     compilare. Qui i pezzi restano, e `onChange` scatta solo quando ci sono
     tutti e tre. */
  const [gior, setGior] = useState(0);
  const [mese, setMese] = useState(0);
  const [anno, setAnno] = useState(0);

  /* Allineamento se la data arriva o viene azzerata dall'esterno. */
  useEffect(() => {
    if (!value) return;
    const [a, m, g] = value.split('-').map(Number);
    if (a && m && g) { setAnno(a); setMese(m); setGior(g); }
  }, [value]);

  const annoMax = new Date().getFullYear();
  const anni = useMemo(
    () => Array.from({ length: annoMax - annoMin + 1 }, (_, i) => annoMax - i),
    [annoMax, annoMin],
  );
  const giorni = useMemo(
    () => Array.from({ length: giorniDelMese(anno, mese) }, (_, i) => i + 1),
    [anno, mese],
  );

  /* Comunica al genitore solo quando la data è completa; altrimenti dice
     "non ancora", senza però perdere ciò che l'utente ha già scelto. */
  const propaga = (g: number, m: number, a: number) => {
    if (!g || !m || !a) { onChange(''); return; }
    const gValido = Math.min(g, giorniDelMese(a, m));
    if (gValido !== g) setGior(gValido);
    onChange(`${a}-${String(m).padStart(2, '0')}-${String(gValido).padStart(2, '0')}`);
  };

  return (
    <div style={{ display: 'flex', gap: 8 }} id={id}>
      <select
        aria-label="Giorno"
        value={gior || ''}
        onChange={e => { const g = Number(e.target.value); setGior(g); propaga(g, mese, anno); }}
        style={selStyle}
      >
        <option value="">gg</option>
        {giorni.map(g => <option key={g} value={g}>{g}</option>)}
      </select>

      <select
        aria-label="Mese"
        value={mese || ''}
        onChange={e => { const m = Number(e.target.value); setMese(m); propaga(gior, m, anno); }}
        style={{ ...selStyle, flex: 1.6 }}
      >
        <option value="">mese</option>
        {MESI.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
      </select>

      <select
        aria-label="Anno"
        value={anno || ''}
        onChange={e => { const a = Number(e.target.value); setAnno(a); propaga(gior, mese, a); }}
        style={{ ...selStyle, flex: 1.2 }}
      >
        <option value="">anno</option>
        {anni.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  );
}
