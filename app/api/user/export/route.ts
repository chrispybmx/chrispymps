import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Authorization', 'X-Content-Type-Options': 'nosniff' };
// Deliberate allowlist: never export auth metadata, moderation notes or other riders.
const sources = [
  { key:'profile', table:'profiles', owner:'id', order:'id', fields:'id,username,bio,instagram_handle,avatar_url' },
  { key:'riderDetails', table:'rider_details', owner:'user_id', order:'user_id', fields:'birth_date,country_code,region,disciplines,riding_since_year,setup_brand,updated_at' },
  { key:'sessions', table:'cm_rider_sessions', owner:'user_id', order:'id', fields:'id,spot_id,started_at,deadline_at,ended_at,status,visibility,source,mood' },
  { key:'publicTotalsPreference', table:'cm_rider_stats_preferences', owner:'user_id', order:'user_id', fields:'shared,updated_at' },
  { key:'savedSpots', table:'spot_favorites', owner:'user_id', order:'spot_id', fields:'spot_id' },
] as const;

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return NextResponse.json({ok:false, error:'Accedi per scaricare i tuoi dati.'}, {status:401, headers});
  try {
    const db = supabaseAdmin();
    const {data:{user}, error} = await db.auth.getUser(token);
    if (error || !user) return NextResponse.json({ok:false, error:'Sessione scaduta. Accedi di nuovo.'}, {status:401, headers});
    const limit = await checkRateLimit(`account-export:${user.id}`, 3, 3600000);
    if (!limit.allowed) return NextResponse.json({ok:false, error:'Hai già richiesto più download. Riprova tra un’ora.'}, {status:429, headers:{...headers, 'Retry-After':String(Math.max(1, Math.ceil((limit.resetAt-Date.now())/1000)))}});
    const generatedAt = new Date().toISOString();
    const data: Record<string, unknown> = {};
    let bytes = 0;
    for (const source of sources) {
      const rows: Record<string, unknown>[] = [];
      // Stable ordering and bounded pages avoid the default Supabase row cap.
      for (let offset = 0; ; offset += 500) {
        const result = await db.from(source.table).select(source.fields)
          .eq(source.owner, user.id).order(source.order).range(offset, offset+499);
        if (result.error || !Array.isArray(result.data)) throw new Error('EXPORT_UNAVAILABLE');
        bytes += Buffer.byteLength(JSON.stringify(result.data));
        if (bytes > 8*1024*1024 || rows.length+result.data.length > 10000) throw new Error('EXPORT_TOO_LARGE');
        rows.push(...result.data as unknown as Record<string, unknown>[]);
        if (result.data.length < 500) break;
      }
      data[source.key] = rows;
    }
    // Old stored active rows may have expired while the app was closed.
    data.sessions = (data.sessions as Record<string, unknown>[]).map(session =>
      session.status === 'active' && Date.parse(String(session.deadline_at)) <= Date.parse(generatedAt)
        ? {...session, status:'needs_confirmation', ended_at:session.deadline_at} : session);
    return NextResponse.json({
      version:1, generatedAt,
      scope:'Account, profilo, preferenze rider, sessioni e spot salvati. Non è una copia completa di tutti i dati trattati.',
      excluded:['Foto e file', 'Commenti e altri contributi', 'Messaggi e inviti', 'Newsletter', 'Log tecnici', 'Dati del browser'],
      account:{id:user.id, email:user.email, createdAt:user.created_at},
      ...data,
      contact:'christian.ceresato@gmail.com',
    }, {headers:{...headers, 'Content-Disposition':'attachment; filename="chrispy-maps-profilo-sessioni.json"'}});
  } catch (error) {
    const large = error instanceof Error && error.message === 'EXPORT_TOO_LARGE';
    return NextResponse.json({ok:false, error:large
      ? 'Archivio troppo grande per il download diretto. Richiedi una copia a christian.ceresato@gmail.com.'
      : 'Download non disponibile. Riprova o richiedi una copia a christian.ceresato@gmail.com.'}, {status:large?413:503, headers});
  }
}
