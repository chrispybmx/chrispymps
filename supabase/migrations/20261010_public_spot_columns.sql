-- Apply AFTER deploying explicit projections in the public spot API and page.
-- Row-level security filters rows, not columns. Remove broad SELECT so direct
-- PostgREST calls cannot read reviewer_notes or the legacy contributor link.
BEGIN;
REVOKE SELECT ON public.spots FROM anon, authenticated;
REVOKE SELECT (reviewer_notes, submitted_by) ON public.spots FROM anon, authenticated;
GRANT SELECT (
  id,slug,name,type,lat,lon,city,region,country,country_code,description,
  condition,condition_updated_at,status,youtube_url,surface,wax_needed,guardians,
  difficulty,submitted_by_user_id,submitted_by_username,created_at,approved_at,
  updated_at,likes_count,avg_rating,ratings_count,ostacoli
) ON public.spots TO anon, authenticated;
DO $$ BEGIN
  IF has_column_privilege('anon','public.spots','reviewer_notes','SELECT')
     OR has_column_privilege('authenticated','public.spots','reviewer_notes','SELECT') THEN
    RAISE EXCEPTION 'Inherited privilege still exposes reviewer_notes; inspect role grants';
  END IF;
END $$;
COMMIT;
