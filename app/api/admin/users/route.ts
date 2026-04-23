import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/* GET /api/admin/users — list all profiles with spot + comment counts */
export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const sb = supabaseAdmin();

  const { data: profiles, error } = await sb
    .from('profiles')
    .select('id, username, bio, instagram_handle, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Get spot counts per username
  const { data: spotCounts } = await sb
    .from('spots')
    .select('submitted_by_username, status');

  // Get comment counts per username
  const { data: commentCounts } = await sb
    .from('comments')
    .select('username');

  const spotsByUser: Record<string, { total: number; pending: number }> = {};
  for (const s of spotCounts ?? []) {
    const un = s.submitted_by_username ?? '';
    if (!un) continue;
    if (!spotsByUser[un]) spotsByUser[un] = { total: 0, pending: 0 };
    spotsByUser[un].total++;
    if (s.status === 'pending') spotsByUser[un].pending++;
  }

  const commentsByUser: Record<string, number> = {};
  for (const c of commentCounts ?? []) {
    const un = c.username ?? '';
    if (!un) continue;
    commentsByUser[un] = (commentsByUser[un] ?? 0) + 1;
  }

  const data = (profiles ?? []).map(p => ({
    ...p,
    spot_count:    spotsByUser[p.username]?.total   ?? 0,
    pending_spots: spotsByUser[p.username]?.pending ?? 0,
    comment_count: commentsByUser[p.username]       ?? 0,
  }));

  return NextResponse.json({ ok: true, data });
}

/* DELETE /api/admin/users — moderate a user:
   action=delete_comments  → delete all comments by username
   action=suspend          → delete comments + set spots to pending
*/
export async function DELETE(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const { username, action } = await req.json().catch(() => ({}));
  if (!username || !action) {
    return NextResponse.json({ ok: false, error: 'username e action richiesti' }, { status: 400 });
  }

  const sb = supabaseAdmin();

  if (action === 'delete_comments' || action === 'suspend') {
    const { error: commErr } = await sb
      .from('comments')
      .delete()
      .eq('username', username);
    if (commErr) return NextResponse.json({ ok: false, error: commErr.message }, { status: 500 });
  }

  if (action === 'suspend') {
    // Move all approved spots back to pending so they need re-review
    const { error: spotErr } = await sb
      .from('spots')
      .update({ status: 'pending' })
      .eq('submitted_by_username', username)
      .eq('status', 'approved');
    if (spotErr) return NextResponse.json({ ok: false, error: spotErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
