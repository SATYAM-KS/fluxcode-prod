import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, RotateCcw, CheckCircle, Clock, CircleDot } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { formatDateTimeIST } from "@/lib/utils";
import {
  EnrolledCourseCard,
  EnrolledCourseCardSkeleton,
} from "@/components/enrolled-course-card";

export const metadata = {
  title: "Dashboard – FluxCode",
  description: "Your learning dashboard",
};

/* ─── Data fetching ─────────────────────────────────────────────── */

async function getRefundRequests(userId: string) {
  const admin = createAdminClient();

  const { data: enrollments } = await admin
    .from("enrollments")
    .select("id, course_id, refund_status, refund_reason, refund_requested_at, refunded_at")
    .eq("user_id", userId)
    .not("refund_requested_at", "is", null)
    .order("refund_requested_at", { ascending: false });

  if (!enrollments || enrollments.length === 0) return [];

  const courseIds = [...new Set(enrollments.map((e: any) => e.course_id))];
  const { data: courses } = await admin
    .from("courses")
    .select("id, title")
    .in("id", courseIds);

  const courseMap = Object.fromEntries((courses ?? []).map((c: any) => [c.id, c.title]));

  return enrollments.map((e: any) => ({
    ...e,
    courseTitle: courseMap[e.course_id] ?? "Unknown Course",
  }));
}

async function getEnrolledCoursesWithProgress(userId: string) {
  const supabase = createClient();

  // Get all active enrollments (exclude credited refunds; include null refund_status)
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("course_id, refund_status")
    .eq("user_id", userId)
    .or("refund_status.is.null,refund_status.neq.credited");

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

  const [enrolledCourses, refundRequests] = await Promise.all([
    getEnrolledCoursesWithProgress(user.id),
    getRefundRequests(user.id),
  ]);
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

      {/* My Refunds */}
      {refundRequests.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-muted-foreground" />
            My Refunds
          </h2>
          <div className="space-y-3">
            {refundRequests.map((r: any) => {
              const isCredited = r.refund_status === "credited";
              const isProcessed = r.refund_status === "processed" || isCredited;
              const isUnderReview = r.refund_status === "under_review" || isProcessed;
              const isFailed = r.refund_status === "failed";

              const steps = [
                {
                  label: "Requested",
                  done: true,
                  active: false,
                },
                {
                  label: "Under Review",
                  done: isUnderReview || isFailed,
                  active: r.refund_status === "under_review",
                },
                {
                  label: "Processed",
                  done: isProcessed,
                  active: r.refund_status === "processed",
                  failed: isFailed,
                },
                {
                  label: "Amount Credited",
                  done: isCredited,
                  active: !isCredited && isProcessed,
                },
              ];

              const statusColors: Record<string, string> = {
                requested: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
                under_review: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
                processed: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
                credited: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
                failed: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
              };
              const statusLabels: Record<string, string> = {
                requested: "Requested",
                under_review: "Under Review",
                processed: "Processed",
                credited: "Amount Credited",
                failed: "Failed",
              };

              return (
                <div key={r.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">{r.courseTitle}</p>
                      {r.refund_reason && (
                        <p className="mt-0.5 text-sm text-muted-foreground">Reason: {r.refund_reason}</p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Requested on{" "}
                        {formatDateTimeIST(r.refund_requested_at)}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusColors[r.refund_status] ?? "bg-muted text-muted-foreground"}` }>
                      {statusLabels[r.refund_status] ?? r.refund_status}
                    </span>
                  </div>

                  {/* Timeline */}
                  <div className="mt-4 flex items-center">
                    {steps.map((step, i) => (
                      <div key={i} className="flex flex-1 items-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                            step.failed
                              ? "border-destructive bg-destructive/10"
                              : step.done
                              ? "border-green-500 bg-green-500/10"
                              : step.active
                              ? "border-primary bg-primary/10"
                              : "border-border bg-muted/40"
                          }`}>
                            {step.failed ? (
                              <span className="h-2 w-2 rounded-full bg-destructive" />
                            ) : step.done ? (
                              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                            ) : step.active ? (
                              <CircleDot className="h-3.5 w-3.5 text-primary animate-pulse" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-muted-foreground/30" />
                            )}
                          </div>
                          <span className={`hidden sm:block text-[10px] font-medium text-center leading-tight max-w-[56px] ${
                            step.failed ? "text-destructive" : step.done || step.active ? "text-foreground" : "text-muted-foreground/40"
                          }`}>
                            {step.label}
                          </span>
                        </div>
                        {i < steps.length - 1 && (
                          <div className={`sm:mb-4 h-0.5 flex-1 ${
                            step.done ? "bg-green-500" : "bg-border"
                          }`} />
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Mobile step label */}
                  <p className="mt-2 sm:hidden text-xs text-center text-muted-foreground">
                    {statusLabels[r.refund_status] ?? r.refund_status}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
