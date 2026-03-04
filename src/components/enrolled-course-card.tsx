import Link from "next/link";
import Image from "next/image";
import { BookOpen, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EnrolledCourseCardProps {
  course: {
    id: string;
    title: string;
    thumbnail_url: string | null;
    totalLessons: number;
    completedLessons: number;
  };
}

export function EnrolledCourseCard({ course }: EnrolledCourseCardProps) {
  const progress =
    course.totalLessons > 0
      ? Math.round((course.completedLessons / course.totalLessons) * 100)
      : 0;

  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-lg">
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {course.thumbnail_url ? (
          <Image
            src={course.thumbnail_url}
            alt={course.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/20" />
          </div>
        )}
        {/* Progress badge */}
        <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          {progress}% complete
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4 p-4">
        <div>
          <h3 className="line-clamp-2 text-base font-semibold leading-tight">
            {course.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {course.completedLessons} of {course.totalLessons} lessons completed
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                progress === 100
                  ? "bg-green-500"
                  : "bg-primary"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* CTA */}
        <Button asChild className="w-full" size="sm">
          <Link href={`/learn/${course.id}`}>
            {progress === 100 ? "Review Course" : "Continue Learning"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* ─── Skeleton loader ───────────────────────────────────────────── */

export function EnrolledCourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="aspect-video w-full animate-pulse bg-muted" />
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
        <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
