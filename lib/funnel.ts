/**
 * Traccia il percorso dell'utente dentro un modulo.
 *
 * Registra solo a che punto è arrivato e quanto ci ha messo: mai cosa ha
 * scritto, mai chi è. Serve a rispondere a domande come "quanti aprono la
 * registrazione e non la finiscono, e su quale campo si fermano".
 *
 * Non blocca e non fallisce mai in modo visibile: se la rete non va, il dato
 * si perde e l'utente non se ne accorge. Una telemetria che rompe il modulo
 * che sta misurando è peggio che non averla.
 */

export type PassoFunnel = 'aperto' | 'campo' | 'inviato' | 'riuscito' | 'errore' | 'abbandonato';

export class TracciaFunnel {
  private attemptId: string;
  private inizio: number;
  private flow: string;
  private ultimoCampo: string | null = null;
  private chiuso = false;

  constructor(flow = 'signup') {
    this.flow = flow;
    this.attemptId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`.replace(/\D/g, '').padEnd(32, '0').slice(0, 32)
          .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
    this.inizio = Date.now();
  }

  private invia(step: PassoFunnel, extra: { field?: string | null; detail?: string | null } = {}) {
    if (typeof window === 'undefined') return;
    const corpo = JSON.stringify({
      attemptId:   this.attemptId,
      flow:        this.flow,
      step,
      field:       extra.field ?? null,
      detail:      extra.detail ?? null,
      msFromStart: Date.now() - this.inizio,
    });

    /* sendBeacon sopravvive alla chiusura della pagina: senza, l'evento
       "abbandonato" — proprio quello che ci interessa — andrebbe perso. */
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/funnel', new Blob([corpo], { type: 'application/json' }));
        return;
      }
    } catch { /* si ripiega su fetch */ }

    fetch('/api/funnel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: corpo,
      keepalive: true,
    }).catch(() => { /* la telemetria non disturba mai */ });
  }

  aperto()             { this.invia('aperto'); }
  campo(nome: string)  { this.ultimoCampo = nome; this.invia('campo', { field: nome }); }
  inviato()            { this.invia('inviato', { field: this.ultimoCampo }); }
  riuscito()           { this.chiuso = true; this.invia('riuscito'); }
  errore(motivo: string) { this.invia('errore', { field: this.ultimoCampo, detail: motivo }); }

  /** Da chiamare alla chiusura: registra solo se non è già finita bene. */
  abbandonato() {
    if (this.chiuso) return;
    this.chiuso = true;
    this.invia('abbandonato', { field: this.ultimoCampo });
  }
}
