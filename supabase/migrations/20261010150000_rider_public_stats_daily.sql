-- Public profile totals change at most once a day (Europe/Rome) and in whole hours:
-- comparing two readings no longer reveals when a single session ended or how long it was.
-- Only the public function changes; the owner's private history keeps exact values.
begin;

create or replace function public.cm_rider_public_stats(target uuid, viewer uuid default null) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select case when exists(select 1 from public.cm_rider_stats_preferences where user_id=target and shared)
 and (viewer is null or not public.cm_session_is_blocked(viewer,target)) then
  (select jsonb_build_object('confirmedCount',count(*),
   'confirmedSeconds',floor(coalesce(sum(extract(epoch from ended_at-started_at)),0)/3600)*3600)
   from public.cm_rider_sessions where user_id=target and status='confirmed'
    and ended_at<(date_trunc('day',now() at time zone 'Europe/Rome') at time zone 'Europe/Rome'))
 else null end;
$$;
revoke all on function public.cm_rider_public_stats(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cm_rider_public_stats(uuid,uuid) to service_role;

notify pgrst,'reload schema';
commit;
