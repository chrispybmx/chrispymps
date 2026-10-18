-- The map export must never be a second write path into spots.
-- Keep the existing SELECT grants and view definition; honor spots RLS.
BEGIN;
ALTER VIEW public.public_spots_geojson SET (security_invoker = true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.public_spots_geojson FROM PUBLIC, anon, authenticated;
COMMIT;
