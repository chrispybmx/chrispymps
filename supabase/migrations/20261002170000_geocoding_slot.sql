begin;
-- One shared provider slot across serverless instances; no user or location data.
create table public.cm_geocoding_slot (
 singleton boolean primary key default true check (singleton),
 available_at timestamptz not null default '-infinity'
);
insert into public.cm_geocoding_slot(singleton) values(true);
alter table public.cm_geocoding_slot enable row level security;
revoke all on public.cm_geocoding_slot from public, anon, authenticated;

create function public.cm_claim_geocoding_slot() returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare stamp timestamptz:=clock_timestamp();
begin
 update public.cm_geocoding_slot set available_at=stamp+interval '1100 milliseconds'
 where singleton and available_at<=stamp;
 return found;
end $$;
revoke all on function public.cm_claim_geocoding_slot() from public,anon,authenticated;
grant execute on function public.cm_claim_geocoding_slot() to service_role;
commit;
