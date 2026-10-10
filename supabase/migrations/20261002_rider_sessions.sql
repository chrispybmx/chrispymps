-- Requires 20260925_private_session_invites.sql. Staging first; no legacy hours imported.
begin;
create table public.cm_rider_sessions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 spot_id uuid references public.spots(id) on delete set null,
 started_at timestamptz not null default clock_timestamp(), deadline_at timestamptz not null, ended_at timestamptz,
 status text not null default 'active' check(status in ('active','needs_confirmation','confirmed')),
 visibility text not null default 'private' check(visibility in ('private','community')),
 source text not null default 'manual' check(source='manual'), version integer not null default 1,
 mood text check(mood in ('sad','neutral','happy')),
 check(deadline_at>started_at), check(ended_at is null or ended_at>=started_at),
 check((status='active' and ended_at is null) or (status<>'active' and ended_at is not null))
);
create unique index cm_rider_one_active on public.cm_rider_sessions(user_id) where status='active';
create index cm_rider_history on public.cm_rider_sessions(user_id,started_at desc);
create table public.cm_rider_presences (
 session_id uuid primary key references public.cm_rider_sessions(id) on delete cascade,
 refreshed_at timestamptz not null, expires_at timestamptz not null
);
create table public.cm_rider_pilot (
 user_id uuid primary key references auth.users(id) on delete cascade,
 authorized_at timestamptz not null default clock_timestamp(), authorization_note text not null check(length(authorization_note)>0)
);
create table public.cm_rider_settings (
 singleton boolean primary key default true check(singleton), sharing_enabled boolean not null default false
);
insert into public.cm_rider_settings values(true,false);
-- Minimal idempotency tombstones contain no times, spots or deleted session history.
create table public.cm_rider_commands (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null, fingerprint text not null, primary key(user_id,request_id)
);
alter table public.cm_rider_sessions enable row level security;
alter table public.cm_rider_presences enable row level security;
alter table public.cm_rider_pilot enable row level security;
alter table public.cm_rider_settings enable row level security;
alter table public.cm_rider_commands enable row level security;
revoke all on public.cm_rider_sessions,public.cm_rider_presences,public.cm_rider_pilot,public.cm_rider_settings,public.cm_rider_commands from public,anon,authenticated;
grant all on public.cm_rider_sessions,public.cm_rider_presences,public.cm_rider_pilot,public.cm_rider_settings,public.cm_rider_commands to service_role;

-- Keep private durations, but remove presence and stop timers at a deleted place.
create function public.cm_rider_spot_deleted() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.cm_rider_sessions set status='needs_confirmation',
 ended_at=greatest(started_at,least(clock_timestamp(),deadline_at)),version=version+1
 where spot_id=old.id and status='active';
 delete from public.cm_rider_presences p using public.cm_rider_sessions s
 where p.session_id=s.id and s.spot_id=old.id;
 return old;
end $$;
revoke all on function public.cm_rider_spot_deleted() from public,anon,authenticated;
create trigger cm_rider_spot_deleted before delete on public.spots
for each row execute function public.cm_rider_spot_deleted();

create function public.cm_rider_can_share(actor uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select sharing_enabled from public.cm_rider_settings where singleton),false)
 and exists(select 1 from public.cm_rider_pilot where user_id=actor);
$$;
create function public.cm_rider_snapshot(actor uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; stamp timestamptz:=clock_timestamp();
begin
 if actor is null then raise exception 'UNAUTHORIZED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('rider:'||actor::text,0));
 update public.cm_rider_sessions set status='needs_confirmation',ended_at=deadline_at,version=version+1
 where user_id=actor and status='active' and deadline_at<=stamp;
 delete from public.cm_rider_presences p using public.cm_rider_sessions s
 where p.session_id=s.id and s.user_id=actor and (p.expires_at<=stamp or s.status<>'active');
 select jsonb_build_object('serverNow',stamp,'canShare',public.cm_rider_can_share(actor),
 'confirmedCount',count(*) filter(where s.status='confirmed'),
 'confirmedSeconds',coalesce(sum(extract(epoch from s.ended_at-s.started_at)) filter(where s.status='confirmed'),0),
 'sessions',coalesce(jsonb_agg(jsonb_build_object(
 'id',s.id,'spotId',s.spot_id,'spotName',coalesce(sp.name,'Spot eliminato'),'spotSlug',sp.slug,'spotStatus',coalesce(sp.status::text,'deleted'),
 'startedAt',s.started_at,'deadlineAt',s.deadline_at,'endedAt',s.ended_at,
 'status',s.status,'visibility',s.visibility,'source',s.source,'version',s.version,'mood',s.mood,
 'sharing',exists(select 1 from public.cm_rider_presences p where p.session_id=s.id and p.expires_at>stamp) and public.cm_rider_can_share(actor)
 ) order by s.started_at desc),'[]'::jsonb)) into result
 from public.cm_rider_sessions s left join public.spots sp on sp.id=s.spot_id where s.user_id=actor;
 return result;
end $$;

create function public.cm_rider_command(actor uuid,request_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.cm_rider_sessions; stamp timestamptz; action text:=command->>'action';
 fp text:=md5(command::text); previous text; finish timestamptz; chosen_spot uuid; chosen_visibility text;
begin
 if actor is null then raise exception 'UNAUTHORIZED'; end if;
 if request_id is null then raise exception 'INVALID_INPUT'; end if;
 perform pg_advisory_xact_lock(hashtextextended('rider:'||actor::text,0));
 stamp:=clock_timestamp();
 select fingerprint into previous from public.cm_rider_commands c where c.user_id=actor and c.request_id=cm_rider_command.request_id;
 if found then
  if previous<>fp then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return public.cm_rider_snapshot(actor);
 end if;
 perform public.cm_rider_snapshot(actor);
 if action='start' then
  chosen_spot:=(command->>'spotId')::uuid; chosen_visibility:=coalesce(command->>'visibility','private');
  if chosen_visibility not in ('private','community') then raise exception 'INVALID_INPUT'; end if;
  select * into item from public.cm_rider_sessions where user_id=actor and status='active';
  if found then
   if item.spot_id<>chosen_spot then raise exception 'ACTIVE_SESSION'; end if;
   -- Another tab cannot reset the timer or change the original consent.
  else
   if not exists(select 1 from public.spots sp where id=chosen_spot and
     (status='approved' or (status='pending' and chosen_visibility='private' and to_jsonb(sp)->>'submitted_by_user_id'=actor::text))) then raise exception 'SPOT_UNAVAILABLE'; end if;
   if chosen_visibility='community' and not public.cm_rider_can_share(actor) then raise exception 'SHARING_DISABLED'; end if;
   insert into public.cm_rider_sessions(user_id,spot_id,started_at,deadline_at,visibility)
   values(actor,chosen_spot,stamp,stamp+interval '2 hours',chosen_visibility) returning * into item;
   if chosen_visibility='community' then insert into public.cm_rider_presences values(item.id,stamp,item.deadline_at); end if;
  end if;
 else
  select * into item from public.cm_rider_sessions where id=(command->>'id')::uuid and user_id=actor for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if action='hide' then
   delete from public.cm_rider_presences where session_id=item.id;
   update public.cm_rider_sessions set visibility='private',version=version+1 where id=item.id;
  elsif action='mood' then
   if item.status<>'confirmed' then raise exception 'INVALID_STATE'; end if;
   if command->>'mood' is not null and command->>'mood' not in ('sad','neutral','happy') then raise exception 'INVALID_INPUT'; end if;
   update public.cm_rider_sessions set mood=command->>'mood',version=version+1 where id=item.id;
  elsif action='delete' then delete from public.cm_rider_sessions where id=item.id;
  elsif action='stop' then
   if item.status='active' then
    update public.cm_rider_sessions set ended_at=least(stamp,deadline_at),status='confirmed',version=version+1 where id=item.id;
   end if;
   delete from public.cm_rider_presences where session_id=item.id;
  elsif action='renew' then
   if item.status<>'active' then raise exception 'EXPIRED'; end if;
   update public.cm_rider_sessions set deadline_at=stamp+interval '2 hours',version=version+1 where id=item.id;
   if item.visibility='community' and public.cm_rider_can_share(actor) then
    insert into public.cm_rider_presences values(item.id,stamp,stamp+interval '2 hours')
    on conflict(session_id) do update set refreshed_at=excluded.refreshed_at,expires_at=excluded.expires_at;
   end if;
  elsif action in ('confirm','edit') then
   if item.status='active' then raise exception 'INVALID_STATE'; end if;
   if (command->>'version')::integer is distinct from item.version then raise exception 'STALE_SESSION'; end if;
   finish:=(command->>'endedAt')::timestamptz;
   if finish is null or not isfinite(finish) or finish<item.started_at or finish>stamp then raise exception 'INVALID_INPUT'; end if;
   update public.cm_rider_sessions set ended_at=finish,status='confirmed',version=version+1 where id=item.id;
   delete from public.cm_rider_presences where session_id=item.id;
  else raise exception 'INVALID_INPUT'; end if;
 end if;
 insert into public.cm_rider_commands values(actor,request_id,fp);
 return public.cm_rider_snapshot(actor);
end $$;

create function public.cm_rider_presence(actor uuid,chosen_spot uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('count',count(*),'freshAt',max(p.refreshed_at),'validUntil',min(least(p.expires_at,s.deadline_at)),'serverNow',now())
 from public.cm_rider_presences p join public.cm_rider_sessions s on s.id=p.session_id join public.spots sp on sp.id=s.spot_id
 where public.cm_rider_can_share(actor) and public.cm_rider_can_share(s.user_id)
 and s.spot_id=chosen_spot and sp.status='approved' and s.visibility='community'
 and s.status='active' and s.deadline_at>now() and p.expires_at>now()
 and not public.cm_session_is_blocked(actor,s.user_id);
$$;
revoke all on function public.cm_rider_can_share(uuid),public.cm_rider_snapshot(uuid),public.cm_rider_command(uuid,uuid,jsonb),public.cm_rider_presence(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cm_rider_can_share(uuid),public.cm_rider_snapshot(uuid),public.cm_rider_command(uuid,uuid,jsonb),public.cm_rider_presence(uuid,uuid) to service_role;
-- Retire public legacy check-ins without deleting their data.
drop policy if exists sessions_public_read on public.sessions;
revoke all on public.sessions from public,anon,authenticated;
commit;
