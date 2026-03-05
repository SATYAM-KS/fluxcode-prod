-- ================================================================
-- FluxCode – Enrollments RLS policies
-- Run this in the Supabase SQL Editor.
-- ================================================================

-- Enable RLS on enrollments table
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Users can see their own enrollments
DROP POLICY IF EXISTS "Users can view own enrollments" ON public.enrollments;
CREATE POLICY "Users can view own enrollments"
  ON public.enrollments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all enrollments
DROP POLICY IF EXISTS "Admins can view all enrollments" ON public.enrollments;
CREATE POLICY "Admins can view all enrollments"
  ON public.enrollments
  FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Users can insert their own enrollments
DROP POLICY IF EXISTS "Users can insert own enrollments" ON public.enrollments;
CREATE POLICY "Users can insert own enrollments"
  ON public.enrollments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can request a refund on their own enrollments
DROP POLICY IF EXISTS "Users can request refund" ON public.enrollments;
CREATE POLICY "Users can request refund"
  ON public.enrollments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can delete any enrollment
DROP POLICY IF EXISTS "Admins can delete enrollments" ON public.enrollments;
CREATE POLICY "Admins can delete enrollments"
  ON public.enrollments
  FOR DELETE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
