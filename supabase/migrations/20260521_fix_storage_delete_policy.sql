-- Fix: restrict DELETE on spot-photos and status-photos to service_role only.
-- Previously any authenticated user could delete files via Supabase Storage API.

-- Drop overly permissive DELETE policies
DROP POLICY IF EXISTS "Allow authenticated delete spot-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete status-photos" ON storage.objects;
DROP POLICY IF EXISTS "spot-photos delete" ON storage.objects;
DROP POLICY IF EXISTS "status-photos delete" ON storage.objects;

-- All legitimate deletions go through API routes using supabaseAdmin() (service_role),
-- so no replacement policy is needed — service_role bypasses RLS by default.
