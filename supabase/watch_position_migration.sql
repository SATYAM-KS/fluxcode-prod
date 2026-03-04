-- ================================================================
-- FluxCode – Watch Position (Resume from where you left off)
-- Run this in the Supabase SQL Editor.
-- ================================================================

-- ── 1. Add watch_position column to user_progress ───────────────
ALTER TABLE public.user_progress
  ADD COLUMN IF NOT EXISTS watch_position numeric DEFAULT 0;

-- ── 2. Create watch_history table for per-lesson position ───────
--    Separate from user_progress so incomplete lessons are tracked too
CREATE TABLE IF NOT EXISTS public.watch_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id   uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  position    numeric NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_watch_history_user_id   ON public.watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_lesson_id ON public.watch_history(lesson_id);

-- ── 3. RLS policies ─────────────────────────────────────────────
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own watch history"   ON public.watch_history;
CREATE POLICY "Users can view own watch history"
  ON public.watch_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own watch history" ON public.watch_history;
CREATE POLICY "Users can insert own watch history"
  ON public.watch_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own watch history" ON public.watch_history;
CREATE POLICY "Users can update own watch history"
  ON public.watch_history FOR UPDATE
  USING (auth.uid() = user_id);
