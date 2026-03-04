-- ================================================================
-- FluxCode – Lesson Comments
-- Run this in the Supabase SQL Editor.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.lesson_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_comments_lesson_id ON public.lesson_comments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_comments_user_id   ON public.lesson_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_comments_created_at ON public.lesson_comments(created_at DESC);

ALTER TABLE public.lesson_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone enrolled can view comments" ON public.lesson_comments;
CREATE POLICY "Anyone enrolled can view comments"
  ON public.lesson_comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own comments" ON public.lesson_comments;
CREATE POLICY "Users can insert own comments"
  ON public.lesson_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON public.lesson_comments;
CREATE POLICY "Users can delete own comments"
  ON public.lesson_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Also add description column to lessons if not exists
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS description text;

-- Allow all authenticated users to read profiles (needed for comment author names)
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
