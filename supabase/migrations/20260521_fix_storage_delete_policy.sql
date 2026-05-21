-- Fix: restrict DELETE on spot-photos and status-photos to service_role only.
-- Previously any authenticated user could delete files via Supabase Storage API.

-- Drop overly permissive DELETE policies (correct names from 20260428_security_fixes.sql)
DROP POLICY IF EXISTS "service delete spot photos" ON storage.objects;
DROP POLICY IF EXISTS "service delete status photos" ON storage.objects;

-- All legitimate deletions go through API routes using supabaseAdmin() (service_role),
-- so no replacement policy is needed — service_role bypasses RLS by default.
