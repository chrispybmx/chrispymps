import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export interface ActivityItem {
  type: 'new_spot' | 'new_photo' | 'session';
  username: string;
  spotName: string;
  spotSlug: string;
  spotType?: string;
  time: string;
}

/**
 * GET /api/activity-feed
 * Returns the last 20 community events (new spots, photos, sessions).
 */
export async function GET() {
  const sb = supabaseAdmin();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const items: ActivityItem[] = [];

  // 1. Recent approved spots
  const { data: spots } = await sb
    .from('spots')
    .select('submitted_by_username, name, slug, type, created_at')
    .eq('status', 'approved')
    .gte('created_at', fourteenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(20);

  for (const s of spots ?? []) {
    items.push({
      type: 'new_spot',
      username: s.submitted_by_username ?? 'anonimo',
      spotName: s.name,
      spotSlug: s.slug,
      spotType: s.type,
      time: s.created_at,
    });
  }

  // 2. Recent approved photos (join spots for name/slug)
  const { data: photos } = await sb
    .from('spot_photos')
    .select('created_at, uploaded_by, spots!inner(name, slug, type)')
    .eq('moderation_status', 'approved')
    .gte('created_at', fourteenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(20);

  // Resolve usernames for photo uploaders
  const uploaderIds = [...new Set((photos ?? []).map(p => p.uploaded_by).filter(Boolean))];
  const usernameMap: Record<string, string> = {};
  if (uploaderIds.length > 0) {
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, username')
      .in('id', uploaderIds);
    for (const p of profiles ?? []) {
      usernameMap[p.id] = p.username;
    }
  }

  for (const p of photos ?? []) {
    const spot = p.spots as unknown as { name: string; slug: string; type?: string };
    items.push({
      type: 'new_photo',
      username: usernameMap[p.uploaded_by] ?? 'anonimo',
      spotName: spot.name,
      spotSlug: spot.slug,
      spotType: spot.type,
      time: p.created_at,
    });
  }

  // 3. Active sessions
  const { data: sessions } = await sb
    .from('sessions')
    .select('username, started_at, spots!inner(name, slug, type)')
    .gt('expires_at', new Date().toISOString())
    .order('started_at', { ascending: false })
    .limit(20);

  for (const s of sessions ?? []) {
    const spot = s.spots as unknown as { name: string; slug: string; type?: string };
    items.push({
      type: 'session',
      username: s.username ?? 'anonimo',
      spotName: spot.name,
      spotSlug: spot.slug,
      spotType: spot.type,
      time: s.started_at,
    });
  }

  // Deduplica: se stesso spot+tipo+timestamp, tieni solo uno (batch upload = 1 evento)
  const seen = new Set<string>();
  const deduped = items.filter(item => {
    const key = `${item.type}:${item.spotSlug}:${item.time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Filtra "anonimo" — mostra solo attività con username reale
  const named = deduped.filter(item => item.username !== 'anonimo');

  // Merge, sort by time desc, limit 20
  named.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const feed = named.slice(0, 20);

  return NextResponse.json({ ok: true, data: feed }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
