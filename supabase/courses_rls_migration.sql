-- ================================================================
-- FluxCode – Courses RLS policies
-- Run this in the Supabase SQL Editor.
-- ================================================================

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated) can read published courses
DROP POLICY IF EXISTS "Public can view published courses" ON public.courses;
CREATE POLICY "Public can view published courses"
  ON public.courses
  FOR SELECT
  USING (is_published = true);

-- Admins can view all courses (including unpublished)
DROP POLICY IF EXISTS "Admins can view all courses" ON public.courses;
CREATE POLICY "Admins can view all courses"
  ON public.courses
  FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Admins can insert/update/delete courses
DROP POLICY IF EXISTS "Admins can manage courses" ON public.courses;
CREATE POLICY "Admins can manage courses"
  ON public.courses
  FOR ALL
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
