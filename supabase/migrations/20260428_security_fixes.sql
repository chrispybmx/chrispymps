-- Security fixes — 2026-04-28
-- 1. Contributors: rimuovi UPDATE pubblico (inutile, solo admin via service role)
-- 2. spot_photos: valida spot esiste + max 5 foto per spot
-- 3. Storage: path validation + policy DELETE

-- ========== 1. CONTRIBUTORS UPDATE ==========
-- L'update (total_submissions, approved_submissions) avviene solo da admin routes
-- che usano service_role → bypassa RLS. Policy pubblica non serve ed è pericolosa.

drop policy if exists "contributors can update self" on contributors;


-- ========== 2. SPOT_PHOTOS INSERT ==========
-- Sostituisce "anyone can upload photos" (with check true)
-- con controllo: spot esiste + status pending/approved + max 5 foto

drop policy if exists "anyone can upload photos" on spot_photos;

create policy "validated photo upload" on spot_photos
  for insert with check (
    -- spot deve esistere (non può linkare a UUID fantasma)
    exists(
      select 1 from spots
      where id = spot_photos.spot_id
      and status in ('pending', 'approved')
    )
    -- max 5 foto per spot
    and (
      select count(*) from spot_photos existing
      where existing.spot_id = spot_photos.spot_id
    ) < 5
  );


-- ========== 3. STORAGE — PATH VALIDATION ==========
-- Forza path: {spot_id}/{filename} (2 segmenti)
-- Impedisce upload in path arbitrari

drop policy if exists "public upload spot photos" on storage.objects;
drop policy if exists "public upload status photos" on storage.objects;

create policy "public upload spot photos"
  on storage.objects for insert
  with check (
    bucket_id = 'spot-photos'
    and array_length(string_to_array(name, '/'), 1) = 2
  );

create policy "public upload status photos"
  on storage.objects for insert
  with check (
    bucket_id = 'status-photos'
    and array_length(string_to_array(name, '/'), 1) = 2
  );


-- ========== 4. STORAGE — DELETE (admin/service role) ==========
-- Permette delete via service role per pulizia spot rejected

create policy "service delete spot photos"
  on storage.objects for delete
  using (bucket_id = 'spot-photos');

create policy "service delete status photos"
  on storage.objects for delete
  using (bucket_id = 'status-photos');
