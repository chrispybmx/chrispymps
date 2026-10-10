-- All writes to these tables already use authenticated/validated Next.js routes
-- and the service_role client. Browser RLS policies must not bypass those routes.
-- No rows, columns or read permissions are removed.
BEGIN;

DROP POLICY IF EXISTS "anyone can add contributor" ON public.contributors;
DROP POLICY IF EXISTS "anyone can flag" ON public.flags;
DROP POLICY IF EXISTS "anyone can submit spot" ON public.spots;
DROP POLICY IF EXISTS "anyone can upload photos" ON public.spot_photos;
DROP POLICY IF EXISTS "validated photo upload" ON public.spot_photos;
DROP POLICY IF EXISTS "Users insert pending photos" ON public.spot_photos;
DROP POLICY IF EXISTS "anyone can report status" ON public.spot_status_updates;
DROP POLICY IF EXISTS "Authenticated users insert status updates" ON public.spot_status_updates;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.contributors, public.flags,
  public.spots, public.spot_photos, public.spot_status_updates FROM anon, authenticated;

-- Defence against accidentally reapplying the old storage migration.
DROP POLICY IF EXISTS "public upload spot photos" ON storage.objects;
DROP POLICY IF EXISTS "public upload status photos" ON storage.objects;
DROP POLICY IF EXISTS "service delete spot photos" ON storage.objects;
DROP POLICY IF EXISTS "service delete status photos" ON storage.objects;

DO $$
DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY['contributors','flags','spots','spot_photos','spot_status_updates'] LOOP
    IF NOT (has_table_privilege('service_role', 'public.' || name, 'INSERT')
      AND has_table_privilege('service_role', 'public.' || name, 'UPDATE')
      AND has_table_privilege('service_role', 'public.' || name, 'DELETE')) THEN
      RAISE EXCEPTION 'service_role privileges missing on %', name;
    END IF;
  END LOOP;
END $$;
COMMIT;
