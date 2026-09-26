/**
 * Legacy signup telemetry retired: aggregate product counters replace it.
 * Keep the interface while the auth form still calls these methods. This class
 * never sends field names, errors, attempt IDs, timings or network requests.
 * Historical funnel_events records are not deleted by this change.
 */
export type PassoFunnel = 'aperto' | 'campo' | 'inviato' | 'riuscito' | 'errore' | 'abbandonato';
export class TracciaFunnel {
  constructor(_flow = 'signup') {}
  aperto() {}
  campo(_nome: string) {}
  inviato() {}
  riuscito() {}
  errore(_motivo: string) {}
  abbandonato() {}
}
