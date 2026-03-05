import { BookOpen } from "lucide-react";

import { CourseCard } from "@/components/course-card";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { createClient } from "@/lib/supabase/server";
import type { Course } from "@/types";

export const metadata = {
  title: "Courses – FluxCode",
  description: "Browse all published courses on FluxCode.",
};

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const admin = createAdminClient();
  const supabase = createClient();

  const [{ data: coursesRaw }, { data: { user } }] = await Promise.all([
    admin.from("courses").select("*").eq("is_published", true).order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);

  const courses: Course[] = coursesRaw ?? [];

  let enrolledIds = new Set<string>();
  if (user) {
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("course_id")
      .eq("user_id", user.id)
      .not("refund_status", "eq", "credited");
    enrolledIds = new Set((enrollments ?? []).map((e: any) => e.course_id));
  }

  return (
    <main>
      {/* Page header */}
      <div className="border-b border-border bg-muted/30 py-12">
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            All Courses
          </h1>
          <p className="mt-2 text-muted-foreground">
            {courses.length > 0
              ? `${courses.length} course${courses.length === 1 ? "" : "s"} available`
              : "Courses coming soon"}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {courses.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} isEnrolled={enrolledIds.has(course.id)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-32 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <BookOpen className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h2 className="text-lg font-semibold">No courses yet</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              We&apos;re working hard to bring you great courses. Check back soon!
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
