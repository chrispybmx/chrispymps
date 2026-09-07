// Prepara l'import in Brevo partendo dall'export CSV di MailerLite.
//
// Non chiama nessuna API: legge un CSV e ne scrive altri, uno per lista Brevo,
// pronti da caricare a mano da Contacts > Import. Volutamente offline — l'import
// e' un'operazione che si fa una volta e va guardata prima di premere invio.
//
// Fa tre cose che l'import diretto di Brevo non farebbe:
//
//  1. SCIOGLIE IL GRUPPO ARTEFATTO. Su MailerLite un gruppo da 32 contatti (quasi
//     meta' lista) ha per nome quattro nomi di gruppo concatenati: e' il residuo di
//     un import andato storto, non un gruppo vero. Chi sta li' dentro E ANCHE in un
//     gruppo vero perde l'appartenenza all'artefatto. Chi sta SOLO li' non ha una
//     casa: finisce in 'residuo-import' e va deciso a mano, non infilato nella
//     newsletter sperando che vada bene.
//
//  2. NON ESPORTA COME ATTIVO CHI NON LO E'. unsubscribed, unconfirmed, bounced e
//     junk finiscono in _esclusi.csv con il motivo. Importarli come confermati
//     significa ricominciare a scrivere a gente che aveva chiuso: e' il modo piu'
//     veloce per bruciare la reputazione del dominio su un mittente nuovo.
//
//  3. Normalizza gli attributi sui nomi che legge lib/brevo.ts (NOME, INSTAGRAM),
//     cosi i contatti importati e quelli iscritti dal sito hanno la stessa forma.
//
// Uso:
//   node scripts/brevo-import.mjs <export-mailerlite.csv>
//   node scripts/brevo-import.mjs <export.csv> --out tmp/brevo
//   node scripts/brevo-import.mjs <export.csv> --group "Prima BMX"
//
// --group serve se hai esportato un gruppo per volta (MailerLite lo permette) e il
// CSV quindi non ha una colonna gruppi: tutte le righe del file valgono per quel
// gruppo. Lanciandolo piu' volte sulla stessa cartella --out i file si sommano: legge
// quel che c'e' gia' e lo unisce per email, invece di sovrascriverlo.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Configurazione: l'inventario letto via API MailerLite il 1 set 2026.
// Se un giorno i gruppi cambiano, si cambia qui e basta.
// ---------------------------------------------------------------------------

/** Gruppo MailerLite -> lista Brevo. La chiave e' normalizzata (vedi normKey). */
const GRUPPO_TO_LISTA = {
  'chrispymps spot submission': 'spot-submission',
  'spot submission':            'spot-submission',
  'prima bmx':                  'prima-bmx',
  'newsletter bmx settimanale': 'newsletter-settimanale',
  'gopro 12':                   'gopro-12',
  'iscrizione corsi bmx':       'corsi-bmx',
  'account chrispy maps':       'account-chrispy-maps',
  'coaching call':              'coaching-call',
};

/** Id del gruppo artefatto, se l'export porta gli id invece dei nomi. */
const ARTEFATTO_ID = '186569652817627119';

/**
 * Il NOME del gruppo artefatto, per esteso.
 *
 * Il punto delicato di tutto lo script: questo nome e' fatto di virgole, le stesse
 * che separano i gruppi. Trattandolo come quattro nomi, quei quattro combaciano con
 * quattro liste vere e i 32 contatti finiscono sparpagliati nelle liste di invio —
 * l'esatto contrario di scioglierli.
 *
 * Il riconoscimento lavora su TOKEN NORMALIZZATI, non sulla stringa grezza: si cerca
 * una sequenza consecutiva di token che, normalizzata, combacia con le quattro parti
 * qui sotto. Cosi' '...Call, Corsi...' e '...Call,Corsi...' sono la stessa cosa, e non
 * dipende da come MailerLite ha deciso di spaziare le virgole nell'export.
 *
 * Limite noto e non risolvibile da qui: un contatto iscritto davvero a quei quattro
 * gruppi, elencati in quest'ordine, e' indistinguibile dall'artefatto. Da una colonna
 * gruppi unica l'informazione non c'e'. Per questo `tasks/brevo-dashboard.md` consiglia
 * l'export un gruppo per volta, che e' l'unico modo non ambiguo.
 */
const ARTEFATTO_NOME = 'Spot Submission, Coaching Call, Corsi, Prima BMX';

/** Lista dove finisce chi sta SOLO nell'artefatto. Non e' una lista di invio. */
const LISTA_RESIDUO = 'residuo-import';

/** Stati MailerLite che possono essere importati come contatti attivi. */
const STATI_OK = new Set(['active', 'confirmed', 'attivo']);

// ---------------------------------------------------------------------------
// CSV: parser minimo ma corretto sulle virgolette. Niente dipendenze.
// ---------------------------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  // Toglie il BOM: MailerLite lo mette, e senza questo la prima intestazione
  // diventa '﻿email' e nessuna colonna viene riconosciuta. Scritto come
  // escape e non come carattere: un BOM letterale nel sorgente e' invisibile,
  // e il primo editor che "ripulisce" il file lo porta via senza che si veda.
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }

    if (c === '"')      quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
    else                field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function toCsv(rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\n') + '\n';
}

/** Chiave di confronto: minuscole, senza accenti/trattini/punteggiatura, spazi singoli. */
function normKey(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Trova l'indice della prima intestazione che combacia con uno dei candidati. */
function findCol(headers, candidates) {
  const norm = headers.map(normKey);
  for (const cand of candidates) {
    const i = norm.indexOf(normKey(cand));
    if (i !== -1) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Argomenti
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith('--'));
const outDir  = args.includes('--out')   ? args[args.indexOf('--out') + 1]   : 'tmp/brevo-import';
const forced  = args.includes('--group') ? args[args.indexOf('--group') + 1] : null;

if (!csvPath) {
  console.error('Uso: node scripts/brevo-import.mjs <export-mailerlite.csv> [--out DIR] [--group "Nome"]');
  process.exit(1);
}
if (!existsSync(csvPath)) {
  console.error(`File non trovato: ${csvPath}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Lettura
// ---------------------------------------------------------------------------

const rows = parseCsv(readFileSync(csvPath, 'utf8'));
if (rows.length < 2) {
  console.error('Il CSV non ha righe oltre all\'intestazione.');
  process.exit(1);
}

const headers = rows[0];
const iEmail  = findCol(headers, ['email', 'e-mail', 'email address', 'indirizzo email']);
const iName   = findCol(headers, ['name', 'nome', 'first name', 'nome e cognome']);
const iLast   = findCol(headers, ['last name', 'cognome']);
const iInsta  = findCol(headers, ['instagram', 'ig', 'profilo instagram']);
const iStatus = findCol(headers, ['status', 'stato', 'subscriber status']);
const iGroups = findCol(headers, ['groups', 'gruppi', 'group', 'gruppo', 'group names', 'segments']);

if (iEmail === -1) {
  console.error('Nessuna colonna email riconosciuta. Intestazioni trovate:');
  console.error(headers.join(' | '));
  process.exit(1);
}
if (iGroups === -1 && !forced) {
  console.error('Il CSV non ha una colonna gruppi e non hai passato --group.');
  console.error('Esporta con i gruppi, oppure esporta un gruppo per volta e lancia:');
  console.error('  node scripts/brevo-import.mjs <file.csv> --group "Prima BMX"');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Smistamento
// ---------------------------------------------------------------------------

/** lista -> Map(email -> riga) — Map perche' lo stesso indirizzo puo' ripetersi. */
const perLista = new Map();
const esclusi  = [];
const sconosciuti = new Map(); // nome gruppo non mappato -> quante volte
let inArtefatto = 0;
let soloArtefatto = 0;

const aggiungi = (lista, contatto) => {
  if (!perLista.has(lista)) perLista.set(lista, new Map());
  perLista.get(lista).set(contatto.email.toLowerCase(), contatto);
};

/**
 * Toglie l'artefatto da una lista di token gia' spezzata, e dice se c'era.
 *
 * Riconoscimento e rimozione avvengono sulla stessa base normalizzata: se si
 * riconosce su una forma e si rimuove su un'altra, il caso in cui le due non
 * combaciano passa per "nessun artefatto" e i contatti si sparpagliano in silenzio.
 *
 * Vale sia per la colonna gruppi sia per --group: e' proprio con --group che si
 * passa il nome dell'artefatto per esteso, esportandolo come gruppo singolo.
 */
function staccaArtefatto(token) {
  const parti = ARTEFATTO_NOME.split(',').map(normKey).filter(Boolean);
  const resto = [];
  let trovato = false;

  for (let i = 0; i < token.length; i++) {
    // L'id secco, se l'export porta gli id invece dei nomi.
    if (token[i].includes(ARTEFATTO_ID)) { trovato = true; continue; }

    // Una sequenza consecutiva di token che ricompone il nome dell'artefatto.
    const combacia = parti.every((p, k) => normKey(token[i + k] ?? '') === p);
    if (combacia) { trovato = true; i += parti.length - 1; continue; }

    resto.push(token[i]);
  }

  return { resto, trovato };
}

for (const r of rows.slice(1)) {
  const email = (r[iEmail] ?? '').trim();
  if (!email || !email.includes('@')) continue;

  const stato = normKey(iStatus !== -1 ? r[iStatus] : 'active');
  if (stato && !STATI_OK.has(stato)) {
    esclusi.push([email, stato, 'stato non attivo su MailerLite']);
    continue;
  }

  const nome = [r[iName] ?? '', iLast !== -1 ? (r[iLast] ?? '') : ''].join(' ').trim();
  const contatto = {
    email,
    nome,
    instagram: iInsta !== -1 ? (r[iInsta] ?? '').trim() : '',
  };

  // I gruppi possono essere separati da virgola, punto e virgola o pipe a seconda
  // di come e' stato fatto l'export. --group passa di qui come tutto il resto:
  // e' il caso in cui e' PIU' probabile ricevere il nome dell'artefatto per esteso.
  const token = (forced ?? String(r[iGroups] ?? ''))
    .split(/[;|,]/).map((g) => g.trim()).filter(Boolean);

  const { resto: grezzi, trovato: toccaArtefatto } = staccaArtefatto(token);

  const liste = new Set();

  for (const g of grezzi) {
    const lista = GRUPPO_TO_LISTA[normKey(g)];
    if (lista) liste.add(lista);
    else sconosciuti.set(g, (sconosciuti.get(g) ?? 0) + 1);
  }

  if (toccaArtefatto) inArtefatto++;

  if (liste.size === 0) {
    // Nessuna lista vera. Se veniva dall'artefatto lo diciamo, cosi il residuo
    // resta distinguibile da un contatto senza gruppi del tutto.
    if (toccaArtefatto) soloArtefatto++;
    aggiungi(LISTA_RESIDUO, contatto);
    continue;
  }

  for (const l of liste) aggiungi(l, contatto);
}

// ---------------------------------------------------------------------------
// Scrittura
// ---------------------------------------------------------------------------

mkdirSync(outDir, { recursive: true });

// Intestazioni Brevo: EMAIL piu' gli attributi in maiuscolo, gli stessi nomi che
// scrive lib/brevo.ts. Cosi un contatto importato e uno iscritto dal form hanno
// la stessa forma e le automazioni possono usare {{ contact.NOME }} su entrambi.
const HEADER = ['EMAIL', 'NOME', 'INSTAGRAM'];

/**
 * Somma a quel che c'e' gia', non sovrascrive.
 *
 * Serve perche' l'export consigliato e' un gruppo per volta: due lanci consecutivi
 * sulla stessa --out possono ricadere sulla stessa lista (per dire, 'ChrispyMPS —
 * Spot Submission' e 'Spot Submission' mappano entrambi su spot-submission). Con una
 * scrittura secca il secondo lancio si mangia il primo senza dire niente.
 *
 * Chi arriva dopo vince sui campi: e' il dato piu' fresco.
 */
function unisciEsistente(file, contatti) {
  if (!existsSync(file)) return contatti;

  const righe = parseCsv(readFileSync(file, 'utf8')).slice(1);
  const unito = new Map();
  for (const [email, nome, instagram] of righe) {
    if (email) unito.set(email.toLowerCase(), { email, nome: nome ?? '', instagram: instagram ?? '' });
  }
  for (const [k, v] of contatti) unito.set(k, v);
  return unito;
}

const scritti = [];
for (const [lista, contatti] of [...perLista.entries()].sort()) {
  const file  = join(outDir, `${lista}.csv`);
  const tutti = unisciEsistente(file, contatti);
  const out   = [HEADER, ...[...tutti.values()].map((c) => [c.email, c.nome, c.instagram])];
  writeFileSync(file, toCsv(out), 'utf8');
  scritti.push([lista, tutti.size, file, tutti.size - contatti.size]);
}

if (esclusi.length) {
  // Anche gli esclusi si sommano fra un lancio e l'altro: e' l'elenco di chi NON
  // va importato, perderne meta' su un secondo export e' peggio che non averlo.
  const file  = join(outDir, '_esclusi.csv');
  const prima = existsSync(file) ? parseCsv(readFileSync(file, 'utf8')).slice(1) : [];
  const unito = new Map(prima.map((r) => [String(r[0]).toLowerCase(), r]));
  for (const r of esclusi) unito.set(r[0].toLowerCase(), r);

  writeFileSync(file, toCsv([['EMAIL', 'STATO', 'MOTIVO'], ...unito.values()]), 'utf8');
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const unici = new Set();
for (const c of perLista.values()) for (const e of c.keys()) unici.add(e);

console.log(`\nLetto  ${csvPath}  (${rows.length - 1} righe)\n`);
console.log('Liste pronte da importare:');
for (const [lista, n, file, giaCera] of scritti) {
  const nota = lista === LISTA_RESIDUO
    ? '   <- NON e\' una lista di invio, guardala'
    : (giaCera ? `   (${giaCera} da lanci precedenti)` : '');
  console.log(`  ${String(n).padStart(4)}  ${lista.padEnd(24)} ${file}${nota}`);
}

console.log(`\n  ${unici.size} contatti unici, ${esclusi.length} esclusi.`);

if (inArtefatto) {
  console.log(
    `\nGruppo artefatto: ${inArtefatto} contatti lo toccavano, ` +
    `${inArtefatto - soloArtefatto} sciolti nelle liste vere, ` +
    `${soloArtefatto} finiti in ${LISTA_RESIDUO}.csv.`,
  );
}

if (esclusi.length) {
  const perMotivo = esclusi.reduce((acc, [, stato]) => {
    acc[stato] = (acc[stato] ?? 0) + 1;
    return acc;
  }, {});
  console.log('\nEsclusi per stato:', perMotivo, '-> _esclusi.csv');
  console.log('Non importarli come confermati: e\' il modo piu\' veloce per bruciare');
  console.log('la reputazione di un mittente nuovo.');
}

if (sconosciuti.size) {
  console.log('\nGruppi non riconosciuti (i contatti sono comunque salvi nelle altre liste):');
  for (const [g, n] of sconosciuti) console.log(`  ${String(n).padStart(4)}  ${g}`);
  console.log('Se uno di questi conta, aggiungilo a GRUPPO_TO_LISTA e rilancia.');
}

console.log('\nProssimo passo: Brevo > Contacts > Import, un file per lista.');
console.log('Le liste vanno create PRIMA, altrimenti Brevo ne inventa una col nome del file.\n');
