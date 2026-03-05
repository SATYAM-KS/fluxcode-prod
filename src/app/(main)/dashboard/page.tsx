import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import {
  EnrolledCourseCard,
  EnrolledCourseCardSkeleton,
} from "@/components/enrolled-course-card";

export const metadata = {
  title: "Dashboard – FluxCode",
  description: "Your learning dashboard",
};

/* ─── Data fetching ─────────────────────────────────────────────── */

async function getEnrolledCoursesWithProgress(userId: string) {
  const supabase = createClient();

  // Get all active enrollments (exclude refunded ones)
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("course_id, refund_status")
    .eq("user_id", userId)
    .not("refund_status", "eq", "processed");

  if (!enrollments || enrollments.length === 0) return [];

  const courseIds = enrollments.map((e) => e.course_id);

  // Fetch courses + all lessons + user progress in parallel
  const [{ data: courses }, { data: allLessons }, { data: userProgress }] =
    await Promise.all([
      supabase
        .from("courses")
        .select("id, title, thumbnail_url")
        .in("id", courseIds)
        .eq("is_published", true),
      supabase
        .from("lessons")
        .select("id, section_id, sections!inner(course_id)")
        .in("sections.course_id", courseIds),
      supabase.from("user_progress").select("lesson_id").eq("user_id", userId),
    ]);

  if (!courses) return [];

  const completedLessonIds = new Set(
    (userProgress ?? []).map((p) => p.lesson_id)
  );

  // Build lesson count per course
  const lessonsByCourse = (allLessons ?? []).reduce<Record<string, number>>(
    (acc, lesson: any) => {
      const courseId = lesson.sections?.course_id;
      if (courseId) acc[courseId] = (acc[courseId] ?? 0) + 1;
      return acc;
    },
    {}
  );

  // Build completed count per course
  const completedByCourse = (allLessons ?? []).reduce<Record<string, number>>(
    (acc, lesson: any) => {
      const courseId = lesson.sections?.course_id;
      if (courseId && completedLessonIds.has(lesson.id)) {
        acc[courseId] = (acc[courseId] ?? 0) + 1;
      }
      return acc;
    },
    {}
  );

  return courses.map((course) => ({
    id: course.id,
    title: course.title,
    thumbnail_url: course.thumbnail_url,
    totalLessons: lessonsByCourse[course.id] ?? 0,
    completedLessons: completedByCourse[course.id] ?? 0,
  }));
}

/* ─── Page ──────────────────────────────────────────────────────── */

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();

  const enrolledCourses = await getEnrolledCoursesWithProgress(user.id);
  const displayName = profile?.email?.split("@")[0] ?? "there";

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      {/* Greeting */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {displayName} 👋
          </h1>
          <p className="mt-2 text-muted-foreground">
            Continue your learning journey
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/profile">Profile</Link>
          </Button>
          <SignOutButton />
        </div>
      </div>

      {/* My Courses */}
      <section>
        <h2 className="mb-6 text-xl font-semibold">My Courses</h2>

        {enrolledCourses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
            <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="mb-2 text-lg font-medium">
              You haven&apos;t enrolled in any courses yet
            </p>
            <p className="mb-6 text-sm text-muted-foreground">
              Explore our course catalog and start learning today
            </p>
            <Button asChild>
              <Link href="/courses">Browse Courses</Link>
            </Button>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <EnrolledCourseCardSkeleton key={i} />
                ))}
              </div>
            }
          >
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {enrolledCourses.map((course) => (
                <EnrolledCourseCard key={course.id} course={course} />
              ))}
            </div>
          </Suspense>
        )}
      </section>
    </main>
  );
}
