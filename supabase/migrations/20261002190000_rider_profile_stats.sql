-- Optional public totals only. Never grants access to private session rows.
begin;
create table public.cm_rider_stats_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 shared boolean not null default false,
 updated_at timestamptz not null default clock_timestamp()
);
alter table public.cm_rider_stats_preferences enable row level security;
revoke all on public.cm_rider_stats_preferences from public,anon,authenticated;
grant all on public.cm_rider_stats_preferences to service_role;

create function public.cm_rider_stats_preference(actor uuid, shared_value boolean default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if actor is null then raise exception 'UNAUTHORIZED'; end if;
 if shared_value is not null then
  insert into public.cm_rider_stats_preferences(user_id,shared) values(actor,shared_value)
  on conflict(user_id) do update set shared=excluded.shared,updated_at=clock_timestamp();
 end if;
 return jsonb_build_object('shared',coalesce((select shared from public.cm_rider_stats_preferences where user_id=actor),false));
end $$;

create function public.cm_rider_public_stats(target uuid, viewer uuid default null) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select case when exists(select 1 from public.cm_rider_stats_preferences where user_id=target and shared)
 and (viewer is null or not public.cm_session_is_blocked(viewer,target)) then
  (select jsonb_build_object('confirmedCount',count(*),
   'confirmedSeconds',coalesce(sum(extract(epoch from ended_at-started_at)),0))
   from public.cm_rider_sessions where user_id=target and status='confirmed')
 else null end;
$$;
revoke all on function public.cm_rider_stats_preference(uuid,boolean),public.cm_rider_public_stats(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cm_rider_stats_preference(uuid,boolean),public.cm_rider_public_stats(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
