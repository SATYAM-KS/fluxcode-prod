import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Lock,
  PlayCircle,
  BookOpen,
  Clock,
  CheckCircle,
  User,
  ChevronRight,
} from "lucide-react";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { Button } from "@/components/ui/button";
import { RazorpayEnrollButton } from "@/components/razorpay-enroll-button";
import { RefundSection } from "@/components/refund-section";
import { isAdmin } from "@/lib/supabase/get-user-role";

export const dynamic = "force-dynamic";

/* ─── Types ────────────────────────────────────────────────────── */

type Lesson = {
  id: string;
  title: string;
  duration: number | null;
  order_index: number;
  is_free_preview: boolean;
};

type Section = {
  id: string;
  title: string;
  order_index: number;
  lessons: Lesson[];
};

type CourseDetail = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number;
  is_published: boolean;
  created_at: string;
};

/* ─── Data fetching ─────────────────────────────────────────────── */

async function getCourseData(id: string) {
  const supabase = createClient();     // for auth / enrollment (session-aware)
  const admin = createAdminClient(); // for public data  (bypasses RLS)

  const [{ data: course }, { data: sectionsRaw }, { data: userData }] =
    await Promise.all([
      admin.from("courses").select("*").eq("id", id).single(),
      admin
        .from("sections")
        .select("id, title, order_index, lessons(id, title, duration, order_index, is_free_preview)")
        .eq("course_id", id)
        .order("order_index"),
      supabase.auth.getUser(),
    ]);

  if (!course || !course.is_published) return null;

  const user = userData?.user ?? null;

  let isEnrolled = false;
  let enrollmentMeta: {
    purchased_at: string | null;
    refund_requested_at: string | null;
    refund_status: string | null;
    refunded_at: string | null;
  } | null = null;
  if (user) {
    // Admins get automatic access to every course
    const adminUser = await isAdmin(user.id);
    if (adminUser) {
      isEnrolled = true;
    } else {
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("id, purchased_at, refund_requested_at, refund_status, refunded_at")
        .eq("user_id", user.id)
        .eq("course_id", id)
        .maybeSingle();
      const isRefunded = (enrollment as any)?.refund_status === "credited";
      isEnrolled = !!enrollment && !isRefunded;
      enrollmentMeta = enrollment
        ? {
          purchased_at: (enrollment as any).purchased_at ?? null,
          refund_requested_at: (enrollment as any).refund_requested_at ?? null,
          refund_status: (enrollment as any).refund_status ?? null,
          refunded_at: (enrollment as any).refunded_at ?? null,
        }
        : null;
    }
  }

  const sections: Section[] = (sectionsRaw ?? []).map((s: any) => ({
    id: s.id,
    title: s.title,
    order_index: s.order_index,
    lessons: [...(s.lessons ?? [])].sort(
      (a: Lesson, b: Lesson) => a.order_index - b.order_index
    ),
  }));

  return { course: course as CourseDetail, sections, user, isEnrolled, enrollmentMeta };
}

/* ─── Metadata ──────────────────────────────────────────────────── */

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("courses")
    .select("title, description")
    .eq("id", params.id)
    .single();

  if (!data) return { title: "Course Not Found – FluxCode" };

  return {
    title: `${data.title} – FluxCode`,
    description: data.description ?? undefined,
  };
}

/* ─── Helpers ───────────────────────────────────────────────────── */

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function renderDescription(text: string) {
  return text.split(URL_REGEX).map((part, i) =>
    URL_REGEX.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-primary underline underline-offset-2 hover:text-primary/80"
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

/* ─── Page ──────────────────────────────────────────────────────── */

export default async function CourseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await getCourseData(params.id);
  if (!data) notFound();

  const { course, sections, user, isEnrolled, enrollmentMeta } = data;

  const totalLessons = sections.reduce((acc, s) => acc + s.lessons.length, 0);
  const totalSeconds = sections.reduce(
    (acc, s) => acc + s.lessons.reduce((la, l) => la + (l.duration ?? 0), 0),
    0
  );

  const formattedPrice =
    course.price === 0
      ? "Free"
      : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
      }).format(course.price);

  const highlights = [
    { label: `${totalLessons} on-demand video lessons` },
    { label: `${sections.length} structured sections` },
    ...(totalSeconds > 0 ? [{ label: `${formatDuration(totalSeconds)} of content` }] : []),
    { label: "Full lifetime access" },
    { label: "Certificate of completion" },
  ];

  return (
    <main>
      {/* ── Hero banner ─────────────────────────────────────────── */}
      <div className="border-b border-border bg-muted/30 py-12">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
            {/* Left: meta */}
            <div className="flex flex-col justify-center gap-5">
              {/* breadcrumb */}
              <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Link href="/courses" className="hover:text-foreground">
                  Courses
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span className="line-clamp-1 text-foreground">{course.title}</span>
              </nav>

              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                {course.title}
              </h1>

              {course.description && (
                <p className="max-w-2xl whitespace-pre-wrap text-base text-muted-foreground sm:text-lg">
                  {renderDescription(course.description)}
                </p>
              )}

              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4" />
                  {sections.length} section{sections.length !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <PlayCircle className="h-4 w-4" />
                  {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
                </span>
                {totalSeconds > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {formatDuration(totalSeconds)}
                  </span>
                )}
              </div>

              {/* Instructor */}
              <div className="flex items-center gap-3 pt-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">FluxCode Team</p>
                  <p className="text-xs text-muted-foreground">Course Instructor</p>
                </div>
              </div>
            </div>

            {/* Right: thumbnail (desktop) */}
            {course.thumbnail_url && (
              <div className="relative hidden aspect-video overflow-hidden rounded-xl border border-border shadow-sm lg:block">
                <Image
                  src={course.thumbnail_url}
                  alt={course.title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">

          {/* ── Sections + Lessons ─────────────────────────────── */}
          <div className="space-y-8">
            <div>
              <h2 className="mb-4 text-xl font-bold">Course Content</h2>

              {sections.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                  <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground">No content added yet.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  {sections.map((section, si) => (
                    <div
                      key={section.id}
                      className={si > 0 ? "border-t border-border" : ""}
                    >
                      {/* Section header */}
                      <div className="flex items-center justify-between bg-muted/50 px-4 py-3">
                        <h3 className="font-semibold">{section.title}</h3>
                        <span className="text-xs text-muted-foreground">
                          {section.lessons.length} lesson
                          {section.lessons.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Lessons */}
                      {section.lessons.length > 0 && (
                        <ul className="divide-y divide-border">
                          {section.lessons.map((lesson) => {
                            const canWatch = isEnrolled || lesson.is_free_preview;
                            const inner = (
                              <>
                                <div className="flex items-center gap-3">
                                  {canWatch ? (
                                    <PlayCircle className="h-4 w-4 shrink-0 text-primary" />
                                  ) : (
                                    <Lock className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                                  )}
                                  <span className={canWatch ? "text-foreground" : "text-muted-foreground"}>
                                    {lesson.title}
                                  </span>
                                  {lesson.is_free_preview && !isEnrolled && (
                                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                      Free Preview
                                    </span>
                                  )}
                                </div>
                                {lesson.duration != null && lesson.duration > 0 && (
                                  <span className="ml-4 shrink-0 text-xs text-muted-foreground">
                                    {formatDuration(lesson.duration)}
                                  </span>
                                )}
                              </>
                            );
                            return (
                              <li
                                key={lesson.id}
                                className="flex items-center justify-between px-4 py-3 text-sm"
                              >
                                {canWatch ? (
                                  <Link
                                    href={`/learn/${course.id}?lesson=${lesson.id}`}
                                    className="flex w-full items-center justify-between hover:text-primary"
                                  >
                                    {inner}
                                  </Link>
                                ) : inner}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── What you'll learn ─────────────────────────────── */}
            <div>
              <h2 className="mb-4 text-xl font-bold">What you&apos;ll get</h2>
              <div className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
                {highlights.map((h) => (
                  <div key={h.label} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    <span>{h.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Sidebar ──────────────────────────────────────────── */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {/* Thumbnail (mobile only – shown above fold in sidebar) */}
              {course.thumbnail_url && (
                <div className="relative aspect-video w-full overflow-hidden lg:hidden">
                  <Image
                    src={course.thumbnail_url}
                    alt={course.title}
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              <div className="p-6">
                {/* Price — hidden for enrolled users */}
                {!isEnrolled && (
                  <div className="mb-4 text-4xl font-extrabold">{formattedPrice}</div>
                )}

                {/* CTA */}
                {isEnrolled ? (
                  <Button asChild size="lg" className="w-full">
                    <Link href={`/learn/${course.id}`}>
                      Go to Course
                    </Link>
                  </Button>
                ) : user ? (
                  <RazorpayEnrollButton courseId={course.id} courseTitle={course.title} coursePrice={course.price ?? 0} />
                ) : (
                  <Button asChild size="lg" className="w-full">
                    <Link
                      href={`/login?redirect=${encodeURIComponent(`/courses/${course.id}`)}`}
                    >
                      Sign in to Enroll
                    </Link>
                  </Button>
                )}

                {course.price !== 0 && !isEnrolled && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    3 days money-back guarantee
                  </p>
                )}

                {/* Highlights */}
                <div className="mt-6 space-y-2.5 border-t border-border pt-5">
                  <p className="text-sm font-semibold">This course includes:</p>
                  <ul className="space-y-2">
                    {highlights.map((h) => (
                      <li
                        key={h.label}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                        {h.label}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Enrollment status badge */}
                {isEnrolled && (
                  <div className="mt-5">
                    <div className="flex items-center justify-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-sm font-medium text-green-600 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" />
                      You&apos;re enrolled
                    </div>
                    <RefundSection
                      courseId={course.id}
                      purchasedAt={enrollmentMeta?.purchased_at ?? null}
                      refundRequestedAt={enrollmentMeta?.refund_requested_at ?? null}
                      refundStatus={enrollmentMeta?.refund_status ?? null}
                      refundedAt={enrollmentMeta?.refunded_at ?? null}
                    />
                  </div>
                )}
              </div>
            </div>
          </aside>

        </div>
      </div>
    </main>
  );
}
