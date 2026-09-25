-- Private, invitation-based sessions. This migration does not change live check-ins.
-- Apply through the migration pipeline, never from a public HTTP handler.
begin;

create table public.cm_session_invites (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  spot_id uuid not null references public.spots(id) on delete cascade,
  starts_at timestamptz not null,
  time_zone text not null,
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','blocked')),
  client_id uuid not null,
  sender_unread boolean not null default false,
  recipient_unread boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (sender_id <> recipient_id),
  unique (sender_id, client_id)
);
create index cm_session_invites_sender_inbox on public.cm_session_invites(sender_id, updated_at desc, id desc);
create index cm_session_invites_recipient_inbox on public.cm_session_invites(recipient_id, updated_at desc, id desc);
create index cm_session_invites_sender_rate on public.cm_session_invites(sender_id, created_at desc);
create index cm_session_invites_sender_unread on public.cm_session_invites(sender_id) where sender_unread;
create index cm_session_invites_recipient_unread on public.cm_session_invites(recipient_id) where recipient_unread;
create index cm_session_invites_pending_pair on public.cm_session_invites(sender_id,recipient_id,spot_id) where status='pending';

create table public.cm_session_messages (
  id bigint generated always as identity primary key,
  invite_id uuid not null references public.cm_session_invites(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  client_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (sender_id, client_id)
);
create index cm_session_messages_thread on public.cm_session_messages(invite_id,id desc);
create index cm_session_messages_rate on public.cm_session_messages(sender_id,created_at desc);

create table public.cm_session_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  primary key (blocker_id,blocked_id), check (blocker_id <> blocked_id)
);
create table public.cm_session_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default false
);
create table public.cm_session_reports (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.cm_session_invites(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  snapshot jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  unique(invite_id,reporter_id)
);
create table public.cm_session_email_outbox (
  invite_id uuid primary key references public.cm_session_invites(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  locked_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  last_error text
);
create index cm_session_email_pending on public.cm_session_email_outbox(next_attempt_at) where sent_at is null;

alter table public.cm_session_invites enable row level security;
alter table public.cm_session_messages enable row level security;
alter table public.cm_session_blocks enable row level security;
alter table public.cm_session_preferences enable row level security;
alter table public.cm_session_reports enable row level security;
alter table public.cm_session_email_outbox enable row level security;
create policy cm_session_invites_participants on public.cm_session_invites for select to authenticated
  using (auth.uid() in (sender_id,recipient_id));
create policy cm_session_messages_participants on public.cm_session_messages for select to authenticated
  using (exists (select 1 from public.cm_session_invites i where i.id=invite_id
    and auth.uid() in (i.sender_id,i.recipient_id) and i.status in ('accepted','blocked')));
create policy cm_session_blocks_owner on public.cm_session_blocks for select to authenticated using (blocker_id=auth.uid());
create policy cm_session_preferences_owner on public.cm_session_preferences for select to authenticated using (user_id=auth.uid());
-- Reports and email jobs intentionally have no browser policy.
revoke all on public.cm_session_invites, public.cm_session_messages, public.cm_session_blocks,
  public.cm_session_preferences,public.cm_session_reports,public.cm_session_email_outbox from anon,authenticated;
grant select on public.cm_session_invites,public.cm_session_messages,public.cm_session_blocks,public.cm_session_preferences to authenticated;
grant all on public.cm_session_invites,public.cm_session_messages,public.cm_session_blocks,
  public.cm_session_preferences,public.cm_session_reports,public.cm_session_email_outbox to service_role;
revoke all on sequence public.cm_session_messages_id_seq from anon,authenticated;
grant usage,select on sequence public.cm_session_messages_id_seq to service_role;

-- A single lock key for an unordered pair prevents send/accept racing a block.
create function public.cm_session_lock_pair(a uuid,b uuid) returns void
language sql set search_path=pg_catalog as $$
  select pg_advisory_xact_lock(hashtextextended(least(a::text,b::text)||':'||greatest(a::text,b::text),9183));
$$;
create function public.cm_session_is_blocked(a uuid,b uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(select 1 from public.cm_session_blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));
$$;
create function public.cm_session_invite_json(i public.cm_session_invites,actor uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
  select jsonb_build_object(
    'id',i.id,'sender_id',i.sender_id,'recipient_id',i.recipient_id,
    'sender_username',coalesce(s.username,'Rider'),'recipient_username',coalesce(r.username,'Rider'),
    'sender_avatar',s.avatar_url,'recipient_avatar',r.avatar_url,
    'spot_id',i.spot_id,'spot_name',p.name,'spot_slug',p.slug,'spot_city',p.city,
    'starts_at',i.starts_at,'time_zone',i.time_zone,'note',i.note,
    'status',case when i.status='pending' and i.starts_at<=now() then 'expired' else i.status end,
    'created_at',i.created_at,'updated_at',i.updated_at,
    'unread',case when actor=i.sender_id then i.sender_unread else i.recipient_unread end)
  from public.spots p left join public.profiles s on s.id=i.sender_id
    left join public.profiles r on r.id=i.recipient_id where p.id=i.spot_id;
$$;

create function public.cm_session_create_invite(actor uuid,recipient text,spot uuid,starts timestamptz,zone text,invitation_note text,client uuid,allow_new boolean default true)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare target uuid; existing public.cm_session_invites; result public.cm_session_invites;
begin
  if actor is null or client is null then raise exception 'INVALID_INPUT'; end if;
  -- Serialize per sender before the pair lock: the persistent hourly cap cannot race.
  perform pg_advisory_xact_lock(hashtextextended('session-invite:'||actor::text,9183));
  select * into existing from public.cm_session_invites where sender_id=actor and client_id=client;
  if found then
    if existing.spot_id is distinct from spot or existing.starts_at is distinct from starts
      or existing.time_zone is distinct from zone or existing.note is distinct from btrim(invitation_note)
      or not exists(select 1 from public.profiles where id=existing.recipient_id and lower(username)=lower(btrim(recipient)))
      then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('id',existing.id,'recipientId',existing.recipient_id,'created',false);
  end if;
  if allow_new is not true then raise exception 'RATE_LIMIT'; end if;
  if starts is null or starts<=now() or starts>now()+interval '90 days'
    or invitation_note is null or char_length(invitation_note)>500
    or zone is null or not exists(select 1 from pg_timezone_names where name=zone)
    then raise exception 'INVALID_INPUT'; end if;
  if not exists(select 1 from public.profiles where id=actor and username is not null) then raise exception 'PROFILE_REQUIRED'; end if;
  select id into target from public.profiles where lower(username)=lower(btrim(recipient)) limit 1;
  if target is null then raise exception 'RECIPIENT_UNAVAILABLE'; end if;
  if target=actor then raise exception 'SELF_INVITE'; end if;
  perform public.cm_session_lock_pair(actor,target);
  if public.cm_session_is_blocked(actor,target) then raise exception 'BLOCKED'; end if;
  if not exists(select 1 from public.spots where id=spot and status='approved') then raise exception 'SPOT_UNAVAILABLE'; end if;
  select * into existing from public.cm_session_invites
    where ((sender_id=actor and recipient_id=target) or (sender_id=target and recipient_id=actor))
      and spot_id=spot and status='pending' and starts_at>now() limit 1;
  if found then raise exception 'INVITE_EXISTS'; end if;
  if (select count(*) from public.cm_session_invites where sender_id=actor and created_at>now()-interval '1 hour')>=5 then raise exception 'RATE_LIMIT'; end if;
  insert into public.cm_session_invites(sender_id,recipient_id,spot_id,starts_at,time_zone,note,client_id)
    values(actor,target,spot,starts,zone,btrim(invitation_note),client) returning * into result;
  insert into public.cm_session_email_outbox(invite_id,recipient_id)
    select result.id,target where exists(select 1 from public.cm_session_preferences where user_id=target and email_enabled);
  return jsonb_build_object('id',result.id,'recipientId',target,'created',true);
end;
$$;

create function public.cm_session_inbox(actor uuid,before_time timestamptz default null,before_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare rows_json jsonb; more boolean; cursor_time timestamptz; cursor_id uuid; block_json jsonb;
begin
  if actor is null then raise exception 'NOT_FOUND'; end if;
  with page as (select i.* from public.cm_session_invites i where actor in (i.sender_id,i.recipient_id)
    and (before_time is null or i.updated_at<before_time or (before_id is not null and i.updated_at=before_time and i.id<before_id))
    order by i.updated_at desc,i.id desc limit 41), shown as (select * from page order by updated_at desc,id desc limit 40)
  select coalesce((select jsonb_agg(public.cm_session_invite_json(s::public.cm_session_invites,actor) order by s.updated_at desc,s.id desc) from shown s),'[]'::jsonb),
    (select count(*)>40 from page),
    (select updated_at from shown order by updated_at,id limit 1),(select id from shown order by updated_at,id limit 1)
    into rows_json,more,cursor_time,cursor_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',b.blocked_id,'username',coalesce(p.username,'Rider')) order by b.created_at desc),'[]'::jsonb)
    into block_json from public.cm_session_blocks b left join public.profiles p on p.id=b.blocked_id where b.blocker_id=actor;
  return jsonb_build_object('data',rows_json,'hasMore',more,
    'unreadCount',(select count(*) from public.cm_session_invites where sender_id=actor and sender_unread)
      +(select count(*) from public.cm_session_invites where recipient_id=actor and recipient_unread),
    'nextBefore',case when more then to_char(cursor_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')||'|'||cursor_id::text else null end,
    'emailEnabled',coalesce((select email_enabled from public.cm_session_preferences where user_id=actor),false),'blockedUsers',block_json);
end;
$$;

create function public.cm_session_thread(actor uuid,invitation uuid,after_message bigint default null,before_message bigint default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare item public.cm_session_invites; messages_json jsonb; more boolean;
begin
  select * into item from public.cm_session_invites where id=invitation and actor in (sender_id,recipient_id);
  if not found then raise exception 'NOT_FOUND'; end if;
  if (after_message is not null and before_message is not null) or after_message<0 or before_message<1 then raise exception 'INVALID_INPUT'; end if;
  if item.status in ('accepted','blocked') then
    with page as (select m.* from public.cm_session_messages m where m.invite_id=invitation
      and (after_message is null or m.id>after_message) and (before_message is null or m.id<before_message)
      order by case when after_message is not null then m.id end asc,case when after_message is null then m.id end desc limit 41),
      shown as (select * from page order by case when after_message is not null then id end asc,case when after_message is null then id end desc limit 40)
    select coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from shown s),'[]'::jsonb),(select count(*)>40 from page) into messages_json,more;
  else messages_json:='[]'::jsonb; more:=false;
  end if;
  return jsonb_build_object('invite',public.cm_session_invite_json(item,actor),'messages',messages_json,'hasMore',more,
    'blocked',public.cm_session_is_blocked(item.sender_id,item.recipient_id));
end;
$$;

create function public.cm_session_send_message(actor uuid,invitation uuid,message_body text,client uuid,allow_new boolean default true)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.cm_session_invites; existing public.cm_session_messages; sent public.cm_session_messages;
begin
  if actor is null or client is null or message_body is null or char_length(btrim(message_body)) not between 1 and 2000 then raise exception 'INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended('session-message:'||actor::text,9183));
  select * into item from public.cm_session_invites where id=invitation and actor in (sender_id,recipient_id);
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.cm_session_lock_pair(item.sender_id,item.recipient_id);
  select * into item from public.cm_session_invites where id=invitation for update;
  -- Retrying an already committed send returns it, but cannot create a new send after a block.
  select * into existing from public.cm_session_messages where sender_id=actor and client_id=client;
  if found then
    if existing.invite_id<>invitation or existing.body<>btrim(message_body) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return to_jsonb(existing);
  end if;
  if allow_new is not true then raise exception 'RATE_LIMIT'; end if;
  if public.cm_session_is_blocked(item.sender_id,item.recipient_id) or item.status='blocked' then raise exception 'BLOCKED'; end if;
  if item.status<>'accepted' then raise exception 'NOT_ACCEPTED'; end if;
  if (select count(*) from public.cm_session_messages where sender_id=actor and created_at>now()-interval '1 minute')>=20 then raise exception 'RATE_LIMIT'; end if;
  insert into public.cm_session_messages(invite_id,sender_id,body,client_id) values(invitation,actor,btrim(message_body),client) returning * into sent;
  update public.cm_session_invites set updated_at=clock_timestamp(),
    sender_unread=(actor<>sender_id),recipient_unread=(actor<>recipient_id) where id=invitation;
  return to_jsonb(sent);
end;
$$;

create function public.cm_session_action(actor uuid,invitation uuid,requested_action text,report_reason text default null,read_through timestamptz default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.cm_session_invites; other uuid; evidence jsonb;
begin
  select * into item from public.cm_session_invites where id=invitation and actor in (sender_id,recipient_id);
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.cm_session_lock_pair(item.sender_id,item.recipient_id);
  select * into item from public.cm_session_invites where id=invitation for update;
  other:=case when actor=item.sender_id then item.recipient_id else item.sender_id end;
  if requested_action='read' then
    if read_through is null then raise exception 'INVALID_INPUT'; end if;
    -- A message that arrives after the viewed snapshot must remain unread.
    update public.cm_session_invites set sender_unread=case when actor=sender_id then false else sender_unread end,
      recipient_unread=case when actor=recipient_id then false else recipient_unread end where id=invitation and updated_at=read_through;
  elsif requested_action='block' then
    insert into public.cm_session_blocks(blocker_id,blocked_id) values(actor,other) on conflict do nothing;
    update public.cm_session_invites set status='blocked',updated_at=clock_timestamp()
      where ((sender_id=actor and recipient_id=other) or (sender_id=other and recipient_id=actor)) and status in ('pending','accepted');
    delete from public.cm_session_email_outbox o using public.cm_session_invites i
      where o.invite_id=i.id and o.sent_at is null and ((i.sender_id=actor and i.recipient_id=other) or (i.sender_id=other and i.recipient_id=actor));
  elsif requested_action='unblock' then
    delete from public.cm_session_blocks where blocker_id=actor and blocked_id=other;
    -- Closed invitations remain closed: a new consent is needed for another chat.
  elsif requested_action='report' then
    if report_reason is null or char_length(btrim(report_reason)) not between 1 and 1000 then raise exception 'INVALID_INPUT'; end if;
    select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) into evidence
      from (select id,sender_id,body,created_at from public.cm_session_messages where invite_id=invitation order by id desc limit 20) m;
    insert into public.cm_session_reports(invite_id,reporter_id,reported_id,reason,snapshot)
      values(invitation,actor,other,btrim(report_reason),jsonb_build_object('invite',public.cm_session_invite_json(item,actor),'messages',evidence))
      on conflict(invite_id,reporter_id) do nothing;
  elsif requested_action in ('accept','decline','cancel') then
    if (requested_action in ('accept','decline') and actor<>item.recipient_id)
      or (requested_action='cancel' and actor<>item.sender_id) then raise exception 'FORBIDDEN'; end if;
    if public.cm_session_is_blocked(item.sender_id,item.recipient_id) then raise exception 'BLOCKED'; end if;
    -- Repeated identical actions are harmless retries.
    if item.status=(case requested_action when 'accept' then 'accepted' when 'decline' then 'declined' else 'cancelled' end) then return; end if;
    if item.status<>'pending' then raise exception 'INVALID_STATE'; end if;
    if item.starts_at<=now() then raise exception 'EXPIRED'; end if;
    if requested_action='accept' and not exists(select 1 from public.spots where id=item.spot_id and status='approved') then raise exception 'SPOT_UNAVAILABLE'; end if;
    update public.cm_session_invites set status=case requested_action when 'accept' then 'accepted' when 'decline' then 'declined' else 'cancelled' end,
      updated_at=clock_timestamp(),sender_unread=(actor<>sender_id),recipient_unread=(actor<>recipient_id) where id=invitation;
    delete from public.cm_session_email_outbox where invite_id=invitation and sent_at is null;
  else raise exception 'INVALID_INPUT';
  end if;
end;
$$;

-- Blocks survive a spot/invitation deletion; settings must still be able to undo
-- the actor's own block without needing an existing conversation.
create function public.cm_session_unblock_user(actor uuid,blocked_user uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if actor is null or blocked_user is null or actor=blocked_user then raise exception 'INVALID_INPUT'; end if;
  perform public.cm_session_lock_pair(actor,blocked_user);
  delete from public.cm_session_blocks where blocker_id=actor and blocked_id=blocked_user;
end;
$$;

create function public.cm_session_set_preference(actor uuid,enabled boolean) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if actor is null or enabled is null then raise exception 'INVALID_INPUT'; end if;
  insert into public.cm_session_preferences(user_id,email_enabled) values(actor,enabled)
    on conflict(user_id) do update set email_enabled=excluded.email_enabled;
  if not enabled then delete from public.cm_session_email_outbox where recipient_id=actor and sent_at is null; end if;
end;
$$;

-- No caller-supplied actor is trusted from the browser. Only the server service role
-- can execute these functions, after auth.getUser(token) has verified the actor.
revoke all on function public.cm_session_lock_pair(uuid,uuid),public.cm_session_is_blocked(uuid,uuid),
  public.cm_session_invite_json(public.cm_session_invites,uuid),
  public.cm_session_create_invite(uuid,text,uuid,timestamptz,text,text,uuid,boolean),
  public.cm_session_inbox(uuid,timestamptz,uuid),public.cm_session_thread(uuid,uuid,bigint,bigint),
  public.cm_session_send_message(uuid,uuid,text,uuid,boolean),public.cm_session_action(uuid,uuid,text,text,timestamptz),
  public.cm_session_set_preference(uuid,boolean),public.cm_session_unblock_user(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cm_session_create_invite(uuid,text,uuid,timestamptz,text,text,uuid,boolean),
  public.cm_session_inbox(uuid,timestamptz,uuid),public.cm_session_thread(uuid,uuid,bigint,bigint),
  public.cm_session_send_message(uuid,uuid,text,uuid,boolean),public.cm_session_action(uuid,uuid,text,text,timestamptz),
  public.cm_session_set_preference(uuid,boolean),public.cm_session_unblock_user(uuid,uuid) to service_role;
commit;
