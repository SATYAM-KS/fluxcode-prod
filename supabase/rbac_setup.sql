-- ================================================================
-- FluxCode – RBAC Setup
-- Run this entire script in the Supabase SQL Editor.
-- Safe to re-run (idempotent).
-- ================================================================

-- ── 1. profiles table: add role column if missing ─────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin'));

-- Backfill any existing rows that somehow have a NULL role
UPDATE public.profiles SET role = 'user' WHERE role IS NULL;


-- ── 2. Trigger: auto-create profile row on auth.users INSERT ──────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    'user',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger so the function change takes effect
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();


-- ── 3. RLS policies for profiles ──────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (but NOT the role column)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Prevent self-escalation: new role must equal the existing role
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- Admins can read all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Admins can update any profile (including role)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );


-- ── 4. Grant the service-role permission to call the trigger fn ───
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;


-- ================================================================
-- Promote a user to admin
-- Replace the email below and run this separately.
-- ================================================================
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
