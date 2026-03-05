import Link from "next/link";
import { BookOpen, Video, Award, ArrowRight } from "lucide-react";

import { CourseCard } from "@/components/course-card";
import { createClient } from "@/lib/supabase/server";
import type { Course } from "@/types";
import type { User } from "@supabase/supabase-js";

const features = [
  {
    icon: BookOpen,
    title: "Expert-Crafted Content",
    description:
      "Every course is built by industry professionals with real-world experience.",
  },
  {
    icon: Video,
    title: "Learn at Your Own Pace",
    description:
      "Stream lessons anytime, anywhere. Pick up right where you left off.",
  },
  {
    icon: Award,
    title: "Earn Certificates",
    description:
      "Complete a course and receive a shareable certificate of achievement.",
  },
];

async function getPageData(): Promise<{ courses: Course[]; user: User | null; enrolledIds: Set<string> }> {
  const supabase = createClient();
  const [{ data: coursesData }, { data: { user } }] = await Promise.all([
    supabase
      .from("courses")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase.auth.getUser(),
  ]);

  let enrolledIds = new Set<string>();
  if (user) {
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("course_id")
      .eq("user_id", user.id);
    enrolledIds = new Set((enrollments ?? []).map((e: any) => e.course_id));
  }

  return { courses: coursesData ?? [], user, enrolledIds };
}

export default async function Home() {
  const { courses: featuredCourses, user, enrolledIds } = await getPageData();

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-background via-background to-muted/40 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            New courses added every week
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Unlock Your Potential with{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Expert-Led Courses
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
            Discover a library of high-quality courses. Learn in-demand skills, earn
            certificates, and advance your career — on your schedule.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/courses"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Browse Courses <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={user ? "/dashboard" : "/login"}
              className="inline-flex h-11 items-center rounded-md border border-input bg-background px-6 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {user ? "Dashboard" : "Sign in Free"}
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No credit card required &middot; Cancel anytime
          </p>
        </div>
        {/* decorative blobs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl"
        />
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section className="border-b border-border py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Why FluxCode?</h2>
            <p className="mt-3 text-muted-foreground">
              Everything you need to level up your skills.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center transition-shadow hover:shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Courses ─────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Featured Courses</h2>
              <p className="mt-2 text-muted-foreground">
                Hand-picked courses to get you started.
              </p>
            </div>
            <Link
              href="/courses"
              className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:flex"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {featuredCourses.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featuredCourses.map((course) => (
                <CourseCard key={course.id} course={course} isEnrolled={enrolledIds.has(course.id)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
              <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">No courses published yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Check back soon!
              </p>
            </div>
          )}

          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/courses"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View all courses <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/40 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Start learning today — it&apos;s free
          </h2>
          <p className="mt-4 text-muted-foreground">
            Join thousands of learners and start building real-world skills with
            FluxCode.
          </p>
          <Link
            href="/courses"
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-md bg-primary px-8 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {user ? "Browse Courses" : "Get started for free"} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
