import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/user-stats?username=X
 * Public: returns user XP, level, badges, recent contributions.
 */
const statsUnavailable = () =>
  NextResponse.json({ ok: false, error: 'Statistiche non disponibili' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username');
  if (!username || username.length < 2) {
    return NextResponse.json({ ok: false, error: 'username required' }, { status: 400 });
  }

  const sb = supabaseAdmin();

  // Get profile → user_id
  const { data: profile, error: profileErr } = await sb
    .from('profiles')
    .select('id, username')
    .eq('username', username)
    .maybeSingle();

  if (profileErr) return statsUnavailable();
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'Utente non trovato' }, { status: 404 });
  }

  // Get user_stats
  const { data: stats, error: statsErr } = await sb
    .from('user_stats')
    .select('*')
    .eq('user_id', profile.id)
    .maybeSingle();

  // Get badges
  const { data: userBadges, error: badgesErr } = await sb
    .from('user_badges')
    .select('badge_key, awarded_at, badges(name, description, emoji, category)')
    .eq('user_id', profile.id)
    .order('awarded_at', { ascending: false });

  // Get recent XP events (last 20)
  const { data: recentXP, error: xpErr } = await sb
    .from('point_events')
    .select('event_type, xp_amount, reason, created_at, spot_id, spots(name, slug)')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(20);

  /* Un errore non deve diventare "XP a zero": la risposta e' in cache
     pubblica e mostrerebbe numeri falsi per un minuto a tutti. */
  if (statsErr || badgesErr || xpErr) return statsUnavailable();

  // Default stats if no record yet
  const defaultStats = {
    lifetime_xp: 0,
    monthly_xp: 0,
    current_level: 'New Rider',
    trust_score: 50,
    approved_spots_count: 0,
    approved_photos_count: 0,
    status_confirmations_count: 0,
    current_streak_weeks: 0,
  };

  return NextResponse.json({
    ok: true,
    data: {
      stats: stats || defaultStats,
      badges: userBadges ?? [],
      recentXP: recentXP ?? [],
    },
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
    },
  });
}
