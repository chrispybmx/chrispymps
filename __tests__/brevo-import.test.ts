import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * scripts/brevo-import.mjs decide dove finiscono 72 persone reali. Sbagliare qui
 * non da' un errore: da' un import che sembra riuscito e una campagna mandata a
 * gente che non l'ha chiesta.
 *
 * Il gruppo artefatto di MailerLite si chiama «Spot Submission, Coaching Call,
 * Corsi, Prima BMX» — un nome fatto di virgole, le stesse che separano i gruppi.
 * Trattarlo come quattro nomi lo fa combaciare con quattro liste vere, e i suoi 32
 * contatti finiscono sparpagliati nelle liste di invio: l'opposto di scioglierli.
 *
 * La prima versione dello script lo staccava dalla colonna gruppi ma NON dal
 * percorso --group, che e' quello consigliato in tasks/brevo-dashboard.md; e lo
 * riconosceva su una forma normalizzata rimuovendolo su un'altra, cosi' bastava una
 * virgola senza spazio per non accorgersene. Segnalato da una revisione Codex.
 *
 * Questi test non verificano una funzione: verificano che quei 32 contatti non
 * possano finire in una lista di invio.
 */

const ARTEFATTO = 'Spot Submission, Coaching Call, Corsi, Prima BMX';

let dir: string;

const script = join(__dirname, '..', 'scripts', 'brevo-import.mjs');

beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'brevo-import-')); });
afterAll(() => { rmSync(dir, { recursive: true, force: true }); });

/** Lancia lo script su un CSV al volo e restituisce le liste prodotte. */
function importa(csv: string, args: string[] = [], out = 'o'): Record<string, string[]> {
  const file   = join(dir, `${Math.random().toString(36).slice(2)}.csv`);
  const outDir = join(dir, out);
  writeFileSync(file, csv, 'utf8');
  execFileSync('node', [script, file, '--out', outDir, ...args], { encoding: 'utf8' });

  const liste: Record<string, string[]> = {};
  for (const l of ['newsletter-settimanale', 'prima-bmx', 'spot-submission',
                   'coaching-call', 'corsi-bmx', 'residuo-import', '_esclusi']) {
    const f = join(outDir, `${l}.csv`);
    if (!existsSync(f)) continue;
    liste[l] = readFileSync(f, 'utf8').trim().split('\n').slice(1).map((r) => r.split(',')[0]);
  }
  return liste;
}

/** Le liste da cui parte davvero una campagna. Nel residuo non ci va nessuno per sbaglio. */
const DI_INVIO = ['newsletter-settimanale', 'prima-bmx', 'spot-submission', 'coaching-call', 'corsi-bmx'];

function inListeDiInvio(liste: Record<string, string[]>, email: string): string[] {
  return DI_INVIO.filter((l) => (liste[l] ?? []).includes(email));
}

describe('brevo-import — il gruppo artefatto non entra nelle liste di invio', () => {
  it('via --group, che e\' il percorso consigliato per l\'export', () => {
    const liste = importa('email,name,status\nuno@example.com,Uno,active\n', ['--group', ARTEFATTO], 'g1');

    expect(inListeDiInvio(liste, 'uno@example.com')).toEqual([]);
    expect(liste['residuo-import']).toContain('uno@example.com');
  });

  it.each([
    ['senza spazio dopo la virgola', 'Spot Submission,Coaching Call,Corsi,Prima BMX'],
    ['con spazi in piu\'',            'Spot Submission , Coaching Call , Corsi , Prima BMX'],
    ['come lo scrive MailerLite',     ARTEFATTO],
  ])('via colonna gruppi, %s', (_nome, forma) => {
    const liste = importa(`email,name,status,groups\nx@example.com,X,active,"${forma}"\n`, [], `s${_nome.length}`);

    expect(inListeDiInvio(liste, 'x@example.com')).toEqual([]);
    expect(liste['residuo-import']).toContain('x@example.com');
  });

  it('chi sta anche in un gruppo vero ci resta, e perde solo l\'artefatto', () => {
    const liste = importa(
      `email,name,status,groups\nmisto@example.com,Misto,active,"${ARTEFATTO},Newsletter BMX Settimanale"\n`,
      [], 'm1',
    );

    expect(liste['newsletter-settimanale']).toContain('misto@example.com');
    expect(liste['residuo-import'] ?? []).not.toContain('misto@example.com');
    // Le altre tre liste che compongono il nome dell'artefatto restano vuote.
    expect(inListeDiInvio(liste, 'misto@example.com')).toEqual(['newsletter-settimanale']);
  });
});

describe('brevo-import — chi non e\' attivo non viene importato', () => {
  it.each(['unsubscribed', 'unconfirmed', 'bounced'])('%s finisce fra gli esclusi', (stato) => {
    const liste = importa(
      `email,name,status,groups\nvia@example.com,Via,${stato},"Prima BMX"\n`,
      [], `e${stato.length}`,
    );

    expect(liste['prima-bmx'] ?? []).not.toContain('via@example.com');
    expect(liste['_esclusi']).toContain('via@example.com');
  });
});

describe('brevo-import — due lanci sulla stessa cartella', () => {
  it('sommano invece di sovrascriversi', () => {
    // I due gruppi mappano sulla STESSA lista Brevo: e' il caso in cui il secondo
    // lancio si mangiava il primo in silenzio.
    importa('email,name,status\nalfa@example.com,Alfa,active\n', ['--group', 'ChrispyMPS — Spot Submission'], 'due');
    const liste = importa('email,name,status\nbeta@example.com,Beta,active\n', ['--group', 'Spot Submission'], 'due');

    expect(liste['spot-submission']).toContain('alfa@example.com');
    expect(liste['spot-submission']).toContain('beta@example.com');
  });
});
