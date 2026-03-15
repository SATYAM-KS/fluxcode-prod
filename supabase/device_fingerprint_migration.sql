-- ================================================================
-- FluxCode – Device Enrollment Fingerprint Table
-- Run this in the Supabase SQL Editor.
-- Safe to re-run (idempotent).
-- ================================================================

-- ── 1. Create device_enrollments table ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.device_enrollments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text        NOT NULL,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id   uuid        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast fingerprint + date lookups (the main query pattern)
CREATE INDEX IF NOT EXISTS idx_device_enrollments_fp_date
  ON public.device_enrollments (fingerprint, enrolled_at);

-- Index for user-based lookups
CREATE INDEX IF NOT EXISTS idx_device_enrollments_user
  ON public.device_enrollments (user_id);


-- ── 2. Enable Row Level Security ────────────────────────────────────
ALTER TABLE public.device_enrollments ENABLE ROW LEVEL SECURITY;

-- Only the service role (used by admin client in API routes) can
-- read and write this table. Regular users have no direct access.
-- This ensures that the fingerprint cannot be queried or tampered
-- with by an authenticated user via the Supabase client.

DROP POLICY IF EXISTS "Service role only" ON public.device_enrollments;
-- (No explicit policy needed – with RLS enabled and no policy for
--  the anon/authenticated roles, those roles are implicitly denied.
--  The service_role bypasses RLS by default in Supabase.)


-- ── 3. Grant service_role explicit permissions ──────────────────────
GRANT SELECT, INSERT ON public.device_enrollments TO service_role;


-- ================================================================
-- How the limit works:
--   The /api/enroll route counts rows WHERE fingerprint = $1
--   AND enrolled_at >= NOW() - INTERVAL '30 days'.
--   If count >= 2, enrollment is rejected with HTTP 429.
--
--   Admins (role = 'admin' in profiles) bypass this check entirely.
-- ================================================================
