import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { distanceKm } from '@/lib/nearby-radar';

/**
 * Il mazzo e il voto.
 *
 * GET  /api/swipe?lat=&lon=   → prossime carte da mostrare
 * POST /api/swipe             → registra like o pass
 *
 * Un like fa due cose in un gesto solo, come chiesto: aggiunge il 🔥 pubblico
 * (che alimenta i Top Spot) e mette lo spot nella cartella dei preferiti.
 * I pass si registrano anche se non "fanno" niente: servono a non riproporre
 * la stessa carta, e dicono quali spot vengono scartati di più — che è la
 * lista degli spot con la foto sbagliata.
 */

export const dynamic = 'force-dynamic';

const CARTE_PER_MAZZO = 20;

async function utenteDaToken(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const { data: { user } } = await supabaseAdmin().auth.getUser(auth.slice(7));
  return user ?? null;
}

/* ────────────────────────────── MAZZO ────────────────────────────── */

export async function GET(req: NextRequest) {
  const user = await utenteDaToken(req);
  if (!user) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 });

  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lon = Number(req.nextUrl.searchParams.get('lon'));
  const conPosizione = Number.isFinite(lat) && Number.isFinite(lon);

  const sb = supabaseAdmin();

  /* Le carte già viste non tornano più. */
  const { data: visti } = await sb
    .from('spot_swipes')
    .select('spot_id')
    .eq('user_id', user.id);
  const giaVisti = new Set((visti ?? []).map(v => v.spot_id as string));

  const { data: spots, error } = await sb
    .from('spots')
    .select('id, slug, name, type, city, region, lat, lon, description, condition, submitted_by_username, spot_photos(url, position)')
    .eq('status', 'approved');

  if (error) {
    console.error('[api/swipe] GET:', error.message);
    return NextResponse.json({ ok: false, error: 'Lettura non riuscita' }, { status: 500 });
  }

  type SpotRiga = {
    id: string; slug: string; name: string; type: string;
    city: string | null; region: string | null; lat: number; lon: number;
    description: string | null; condition: string;
    submitted_by_username: string | null;
    spot_photos: { url: string; position: number }[] | null;
  };

  const carte = (spots as SpotRiga[] ?? [])
    .filter(s => !giaVisti.has(s.id))
    /* Senza foto non è una carta: qui si vota guardando. */
    .filter(s => (s.spot_photos?.length ?? 0) > 0)
    .map(s => {
      const foto = [...(s.spot_photos ?? [])].sort((a, b) => a.position - b.position);
      return {
        id: s.id,
        slug: s.slug,
        name: s.name,
        type: s.type,
        city: s.city,
        region: s.region,
        description: s.description,
        condition: s.condition,
        autore: s.submitted_by_username,
        foto: foto.map(f => f.url),
        km: conPosizione ? distanceKm({ lat, lon }, { lat: s.lat, lon: s.lon }) : null,
      };
    });

  /* Vicini prima, se sappiamo dov'è. Altrimenti ordine casuale, così due
     sessioni diverse non mostrano la stessa sequenza. */
  if (conPosizione) {
    carte.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
  } else {
    for (let i = carte.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [carte[i], carte[j]] = [carte[j], carte[i]];
    }
  }

  return NextResponse.json({
    ok: true,
    data: carte.slice(0, CARTE_PER_MAZZO),
    rimanenti: Math.max(0, carte.length - CARTE_PER_MAZZO),
  });
}

/* ────────────────────────────── VOTO ────────────────────────────── */

export async function POST(req: NextRequest) {
  const user = await utenteDaToken(req);
  if (!user) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 });

  const { spotId, direction } = await req.json().catch(() => ({}));
  if (typeof spotId !== 'string' || (direction !== 'like' && direction !== 'pass')) {
    return NextResponse.json({ ok: false, error: 'Richiesta non valida' }, { status: 400 });
  }

  const sb = supabaseAdmin();

  const { error: swipeErr } = await sb
    .from('spot_swipes')
    .upsert({ user_id: user.id, spot_id: spotId, direction }, { onConflict: 'user_id,spot_id' });

  if (swipeErr) {
    console.error('[api/swipe] POST:', swipeErr.message);
    return NextResponse.json({ ok: false, error: 'Salvataggio non riuscito' }, { status: 500 });
  }

  /* Il like alimenta il contatore pubblico e la cartella personale.
     Insert semplice invece di upsert: così non dipendiamo dal nome esatto del
     vincolo di unicità delle due tabelle. Il doppione (23505) è l'esito
     normale di chi rivota, e si ignora. */
  if (direction === 'like') {
    const aggiungi = async (tabella: 'spot_likes' | 'spot_favorites') => {
      const { error } = await sb.from(tabella).insert({ spot_id: spotId, user_id: user.id });
      if (error && error.code !== '23505') {
        console.error(`[api/swipe] ${tabella}:`, error.code, error.message);
      }
    };
    await Promise.all([aggiungi('spot_likes'), aggiungi('spot_favorites')]);
  }

  return NextResponse.json({ ok: true });
}
