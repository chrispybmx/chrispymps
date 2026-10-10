begin;

alter table public.rider_details add column country_code text;
alter table public.rider_details add constraint rider_details_country_code_check
 check(country_code is null or country_code ~ '^[A-Z]{2}$');
alter table public.rider_details drop constraint rider_details_disciplines_check;
alter table public.rider_details add constraint rider_details_disciplines_check
 check(disciplines is null or disciplines <@ array['bmx','skate','scooter','mtb','altro']::text[]);
comment on column public.rider_details.country_code is 'Self-declared residence country; private, not GPS location or proof of residence.';
comment on column public.rider_details.disciplines is 'Private, optional sports: bmx, skate, scooter, mtb, altro.';
-- Small aggregate groups can still identify people. Keep the legacy report
-- server-only rather than relying on default grants or view-owner RLS behavior.
revoke all on public.rider_stats_aggregate from public,anon,authenticated;
grant select on public.rider_stats_aggregate to service_role;
comment on view public.rider_stats_aggregate is 'Internal aggregate report; not public or guaranteed anonymous. Review disclosure risk before external use.';

-- Auth invokes this BEFORE inserting a new account. Installing the function is
-- not enough: configure the Before User Created hook in Supabase separately.
create function public.cm_before_user_created(event jsonb) returns jsonb
language plpgsql set search_path=public,pg_temp as $$
declare
 details jsonb:=event#>'{user,user_metadata,initial_rider_details}';
 born date;
 today date:=(now() at time zone 'UTC')::date;
 country text:=details->>'countryCode';
begin
 if event#>>'{user,app_metadata,provider}' is distinct from 'email' then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Crea il nuovo account con email e data di nascita.'));
 end if;
 if jsonb_typeof(details) is distinct from 'object'
  or jsonb_typeof(details->'birthDate') is distinct from 'string'
  or (details->>'birthDate') !~ '^\d{4}-\d{2}-\d{2}$' then
  return jsonb_build_object('error',jsonb_build_object('http_code',422,'message','Data di nascita non valida.'));
 end if;
 begin born:=(details->>'birthDate')::date;
 exception when others then
  return jsonb_build_object('error',jsonb_build_object('http_code',422,'message','Data di nascita non valida.'));
 end;
 if born<='1920-01-01' or born>today or born>(today-interval '14 years')::date then
  return jsonb_build_object('error',jsonb_build_object('http_code',422,'message','Per registrarti devi avere almeno 14 anni.'));
 end if;
 if country is null or not(country=any(string_to_array('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW',' '))) then
  return jsonb_build_object('error',jsonb_build_object('http_code',422,'message','Scegli il Paese di residenza.'));
 end if;
 if details ? 'disciplines' then
  if jsonb_typeof(details->'disciplines') is distinct from 'array' then
   return jsonb_build_object('error',jsonb_build_object('http_code',422,'message','Sport non validi.'));
  end if;
  if jsonb_array_length(details->'disciplines')>5 or exists(
   select 1 from jsonb_array_elements(details->'disciplines') d
   where jsonb_typeof(d)!='string' or not(d#>>'{}'=any(array['bmx','skate','scooter','mtb','altro']))
  ) then
   return jsonb_build_object('error',jsonb_build_object('http_code',422,'message','Sport non validi.'));
  end if;
 end if;
 return '{}'::jsonb;
end $$;
revoke all on function public.cm_before_user_created(jsonb) from public,anon,authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.cm_before_user_created(jsonb) to supabase_auth_admin;
notify pgrst,'reload schema';
commit;
