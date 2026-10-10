begin;

-- Aggregate spot presence only. Never return rider identities or private history.
create function public.cm_rider_live_map(actor uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object(
  'available',public.cm_rider_can_share(actor),
  'serverNow',now(),
  'spots',coalesce((
   select jsonb_agg(row_to_json(live) order by live."spotId") from (
    select s.spot_id as "spotId",count(*) as count,
     max(p.refreshed_at) as "freshAt",
     min(least(p.expires_at,s.deadline_at)) as "validUntil"
    from public.cm_rider_presences p
    join public.cm_rider_sessions s on s.id=p.session_id
    join public.spots sp on sp.id=s.spot_id
    where public.cm_rider_can_share(actor) and public.cm_rider_can_share(s.user_id)
     and sp.status='approved' and s.visibility='community' and s.status='active'
     and s.deadline_at>now() and p.expires_at>now()
     and not public.cm_session_is_blocked(actor,s.user_id)
    group by s.spot_id
   ) live
  ),'[]'::jsonb)
 );
$$;
revoke all on function public.cm_rider_live_map(uuid) from public,anon,authenticated;
grant execute on function public.cm_rider_live_map(uuid) to service_role;
commit;
