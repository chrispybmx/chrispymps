-- Private, optional signup details: residence country and MTB among the sports.
-- Idempotent and safe on the production schema, where the legacy aggregate view
-- rider_stats_aggregate does not exist. No Before User Created hook: signup must
-- stay immediate (email and Google), see docs/registration-release-2026-10-10.md.
begin;

alter table public.rider_details add column if not exists country_code text;
alter table public.rider_details drop constraint if exists rider_details_country_code_check;
alter table public.rider_details add constraint rider_details_country_code_check
 check(country_code is null or country_code ~ '^[A-Z]{2}$');
alter table public.rider_details drop constraint if exists rider_details_disciplines_check;
alter table public.rider_details add constraint rider_details_disciplines_check
 check(disciplines is null or disciplines <@ array['bmx','skate','scooter','mtb','altro']::text[]);
comment on column public.rider_details.country_code is 'Self-declared residence country; private, optional, not GPS location or proof of residence.';
comment on column public.rider_details.disciplines is 'Private, optional sports: bmx, skate, scooter, mtb, altro.';

-- Small aggregate groups can still identify people. Where the legacy report exists,
-- keep it server-only rather than relying on default grants or view-owner RLS behavior.
do $$
begin
 if to_regclass('public.rider_stats_aggregate') is not null then
  revoke all on public.rider_stats_aggregate from public,anon,authenticated;
  grant select on public.rider_stats_aggregate to service_role;
  comment on view public.rider_stats_aggregate is 'Internal aggregate report; not public or guaranteed anonymous. Review disclosure risk before external use.';
 end if;
end $$;

notify pgrst,'reload schema';
commit;
