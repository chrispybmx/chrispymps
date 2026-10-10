import { privateJson } from '@/lib/session-invites-server';

// Retired GPS check-in: cannot bypass the new consent and pilot gates.
export function GET() { return privateJson({ok:true,data:[]}); }
export function POST() { return privateJson({ok:false,error:'Aggiorna la pagina e usa Inizio sessione nella scheda spot.'},410); }
