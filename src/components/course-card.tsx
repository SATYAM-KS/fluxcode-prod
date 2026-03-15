import Image from "next/image";
import Link from "next/link";
import { BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Course } from "@/types";

interface CourseCardProps {
  course: Course;
  className?: string;
  isEnrolled?: boolean;
}

export function CourseCard({ course, className, isEnrolled }: CourseCardProps) {
  return (
    <Card
      className={cn(
        "group flex flex-col overflow-hidden transition-shadow hover:shadow-md",
        className
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {course.thumbnail_url ? (
          <Image
            src={course.thumbnail_url}
            alt={course.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <BookOpen className="h-10 w-10 opacity-40" />
          </div>
        )}
      </div>

      <CardHeader className="flex-1 pb-2">
        <CardTitle className="line-clamp-2 text-base leading-snug">{course.title}</CardTitle>
        {course.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
        )}
      </CardHeader>

      <CardContent className="pb-3" />

      <CardFooter className="pt-0">
        {isEnrolled ? (
          <Button asChild className="w-full" size="sm" variant="outline">
            <Link href={`/learn/${course.id}`}>Go to Classroom</Link>
          </Button>
        ) : (
          <Button asChild className="w-full" size="sm">
            <Link href={`/courses/${course.id}`}>Enroll Now</Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
