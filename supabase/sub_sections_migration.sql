-- ================================================================
-- FluxCode – Sub-sections (optional groupings within a section)
-- Run this in the Supabase SQL Editor.
-- ================================================================

-- ── 1. Create sub_sections table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sub_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  title text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_sections_section_id ON public.sub_sections(section_id);

-- ── 2. Add optional sub_section_id to lessons ─────────────────────
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS sub_section_id uuid REFERENCES public.sub_sections(id) ON DELETE SET NULL;

-- ── 3. RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.sub_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage sub_sections" ON public.sub_sections;
CREATE POLICY "Admins can manage sub_sections"
  ON public.sub_sections FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Authenticated users can read sub_sections" ON public.sub_sections;
CREATE POLICY "Authenticated users can read sub_sections"
  ON public.sub_sections FOR SELECT TO authenticated
  USING (true);
