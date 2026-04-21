-- ChrispyMPS — Supabase schema
-- Esegui questo SQL nella dashboard Supabase → SQL Editor → nuovo query

-- ========== TABELLE ==========

-- Contributors: chi carica spot (email obbligatoria al primo invio)
create table if not exists contributors (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  device_id text,
  instagram_handle text,
  first_submission_at timestamptz default now(),
  total_submissions int default 0,
  approved_submissions int default 0
);

-- Spot: il cuore della mappa
create type spot_type as enum ('street','park','diy','rail','ledge','trail','plaza','gap','bowl');
create type spot_status as enum ('pending','approved','rejected','archived');
create type spot_condition as enum ('alive','bustato','demolito');

create table if not exists spots (
  id uuid primary key default gen_random_uuid(),
  slug text unique, -- /map/spot/piazza-bra-verona
  name text not null,
  type spot_type not null,
  lat double precision not null,
  lon double precision not null,
  city text,
  region text,
  description text,
  condition spot_condition default 'alive',
  condition_updated_at timestamptz default now(),
  status spot_status default 'pending',
  youtube_url text, -- per integrazione video @chrispy_bmx
  -- filtri dettagliati
  surface text, -- asfalto, marmo, cemento
  wax_needed boolean default false,
  guardians text, -- "sempre libero", "orari X", "evitare"
  difficulty text, -- beginner, intermediate, pro
  -- admin
  submitted_by uuid references contributors(id) on delete set null,
  reviewer_notes text,
  created_at timestamptz default now(),
  approved_at timestamptz,
  updated_at timestamptz default now()
);

create index idx_spots_status on spots(status);
create index idx_spots_city on spots(city);
create index idx_spots_type on spots(type);
create index idx_spots_location on spots(lat, lon);

-- Foto: fino a 5 per spot
create table if not exists spot_photos (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid references spots(id) on delete cascade,
  url text not null,
  position int default 0,
  uploaded_by uuid references contributors(id),
  credit_name text,
  created_at timestamptz default now()
);

create index idx_photos_spot on spot_photos(spot_id);

-- Aggiornamenti stato spot (alive → bustato con foto recente)
create table if not exists spot_status_updates (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid references spots(id) on delete cascade,
  condition spot_condition not null,
  photo_url text,
  note text,
  reported_by uuid references contributors(id),
  created_at timestamptz default now()
);

-- Segnalazioni (spam, foto inappropriata, spot errato)
create table if not exists flags (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid references spots(id) on delete cascade,
  reason text not null,
  details text,
  reporter_email text,
  resolved boolean default false,
  created_at timestamptz default now()
);

-- ========== ROW LEVEL SECURITY ==========

alter table spots enable row level security;
alter table spot_photos enable row level security;
alter table contributors enable row level security;
alter table spot_status_updates enable row level security;
alter table flags enable row level security;

-- Pubblico: può leggere SOLO gli spot approvati
create policy "public read approved spots" on spots
  for select using (status = 'approved');

create policy "public read photos of approved spots" on spot_photos
  for select using (exists(
    select 1 from spots where spots.id = spot_photos.spot_id and spots.status = 'approved'
  ));

create policy "public read status updates" on spot_status_updates
  for select using (true);

-- Pubblico: può INSERIRE nuovi contributor (per il primo invio)
create policy "anyone can add contributor" on contributors
  for insert with check (true);

-- Pubblico: può aggiornare contatori del proprio contributor
create policy "contributors can update self" on contributors
  for update using (true);

-- Pubblico: può inserire nuovi spot (andranno in pending)
create policy "anyone can submit spot" on spots
  for insert with check (status = 'pending');

-- Pubblico: può inserire foto legate al proprio spot
create policy "anyone can upload photos" on spot_photos
  for insert with check (true);

-- Pubblico: può inserire status update
create policy "anyone can report status" on spot_status_updates
  for insert with check (true);

-- Pubblico: può flaggare spot
create policy "anyone can flag" on flags
  for insert with check (true);

-- Admin (service role): bypassa tutto automaticamente

-- ========== STORAGE BUCKETS ==========
-- Esegui questi nella dashboard → Storage → New bucket:
-- 1. bucket "spot-photos"  → public = true  → file size limit 5MB → mime types image/*
-- 2. bucket "status-photos" → public = true → file size limit 5MB → mime types image/*
-- Oppure creali via SQL:

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('spot-photos', 'spot-photos', true, 5242880, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('status-photos', 'status-photos', true, 5242880, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict do nothing;

create policy "public read spot photos"
on storage.objects for select
using (bucket_id = 'spot-photos');

create policy "public upload spot photos"
on storage.objects for insert
with check (bucket_id = 'spot-photos');

create policy "public read status photos"
on storage.objects for select
using (bucket_id = 'status-photos');

create policy "public upload status photos"
on storage.objects for insert
with check (bucket_id = 'status-photos');

-- ========== FUNZIONI UTILI ==========

-- Slugify helper per creare URL spot (piazza bra → piazza-bra)
create or replace function slugify(input text)
returns text language sql immutable as $$
  select regexp_replace(
    regexp_replace(lower(trim(input)), '[àáâãäå]', 'a', 'g'),
    '[^a-z0-9]+', '-', 'g'
  )
$$;

-- Auto-slug on insert
create or replace function set_spot_slug()
returns trigger language plpgsql as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := slugify(new.name) || '-' || coalesce(slugify(new.city), 'italy') || '-' || substring(new.id::text, 1, 6);
  end if;
  return new;
end;
$$;

create trigger set_spot_slug_trigger
  before insert on spots
  for each row execute function set_spot_slug();

-- Auto updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_spot_updated_at
  before update on spots
  for each row execute function set_updated_at();

-- ========== VISTA PUBBLICA GEOJSON ==========
-- Per export/API standard

create or replace view public_spots_geojson as
select
  id,
  slug,
  name,
  type::text,
  city,
  region,
  lat,
  lon,
  description,
  condition::text,
  condition_updated_at,
  approved_at,
  youtube_url,
  surface,
  wax_needed,
  guardians,
  difficulty
from spots
where status = 'approved';

grant select on public_spots_geojson to anon, authenticated;
