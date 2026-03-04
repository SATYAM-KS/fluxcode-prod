import { redirect } from "next/navigation";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { isAdmin } from "@/lib/supabase/get-user-role";
import { LearningInterface } from "@/components/learn/learning-interface";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const admin = createAdminClient();

  const { data: course } = await admin
    .from("courses")
    .select("title")
    .eq("id", courseId)
    .single();

  return {
    title: course ? `${course.title} – Learn` : "Learn – FluxCode",
  };
}

export default async function LearnCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { courseId } = await params;
  const { lesson: lessonId } = await searchParams;

  const supabase = createClient();
  const admin = createAdminClient();

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/learn/${courseId}`);
  }

  // Admins bypass the enrollment check — they have access to all courses
  const userIsAdmin = await isAdmin(user.id);

  if (!userIsAdmin) {
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();

    if (!enrollment) {
      redirect(`/courses/${courseId}`);
    }
  }

  // Fetch course data via admin client (bypasses RLS)
  const { data: course } = await admin
    .from("courses")
    .select("id, title, description")
    .eq("id", courseId)
    .single();

  if (!course) notFound();

  const { data: sections } = await admin
    .from("sections")
    .select("id, title, order_index")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });

  const { data: lessons } = await admin
    .from("lessons")
    .select("id, section_id, title, description, drive_video_url, duration, is_free_preview, order_index")
    .in(
      "section_id",
      (sections ?? []).map((s) => s.id)
    )
    .order("order_index", { ascending: true });

  // Progress tracking always uses the user's own session
  const { data: progressRecords } = await supabase
    .from("user_progress")
    .select("lesson_id")
    .eq("user_id", user.id);

  const completedLessonIds = new Set(
    (progressRecords ?? []).map((p) => p.lesson_id)
  );

  const sectionsWithLessons = (sections ?? []).map((section) => ({
    ...section,
    lessons: (lessons ?? [])
      .filter((l) => l.section_id === section.id)
      .map((lesson) => ({
        ...lesson,
        completed: completedLessonIds.has(lesson.id),
      })),
  }));

  const allLessonIds = (lessons ?? []).map((l) => l.id);

  let activeLessonId = lessonId;
  if (!activeLessonId) {
    // Try to resume from the most recently watched lesson in this course
    const { data: lastWatched } = await supabase
      .from("watch_history")
      .select("lesson_id, updated_at")
      .in("lesson_id", allLessonIds)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastWatched) {
      activeLessonId = lastWatched.lesson_id;
    } else {
      // Fall back to first incomplete lesson, then first lesson
      const allLessonsFlat = sectionsWithLessons.flatMap((s) => s.lessons);
      const firstIncomplete = allLessonsFlat.find((l) => !l.completed);
      activeLessonId = firstIncomplete?.id ?? allLessonsFlat[0]?.id;
    }
  }

  return (
    <LearningInterface
      course={course}
      sections={sectionsWithLessons}
      activeLessonId={activeLessonId ?? null}
      userId={user.id}
    />
  );
}
