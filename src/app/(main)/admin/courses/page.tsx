import Link from "next/link";
import { Plus, Pencil, BookOpen } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { TogglePublishButton } from "@/components/admin/toggle-publish-button";
import { DeleteCourseDialog } from "@/components/admin/delete-course-dialog";

export const metadata = { title: "Courses – Admin | FluxCode" };

async function getCoursesWithCounts() {
  const supabase = createClient();

  const [{ data: courses }, { data: sections }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, description, thumbnail_url, price, is_published, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("sections").select("course_id"),
  ]);

  const countMap = (sections ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.course_id] = (acc[s.course_id] ?? 0) + 1;
    return acc;
  }, {});

  return (courses ?? []).map((c) => ({
    ...c,
    sectionsCount: countMap[c.id] ?? 0,
  }));
}

export default async function AdminCoursesPage() {
  const courses = await getCoursesWithCounts();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {courses.length} course{courses.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/courses/new">
            <Plus className="h-4 w-4" />
            New Course
          </Link>
        </Button>
      </div>

      {/* Empty state */}
      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">No courses yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first course to get started.
          </p>
          <Button asChild className="mt-5" size="sm">
            <Link href="/admin/courses/new">
              <Plus className="h-4 w-4" />
              New Course
            </Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 font-semibold text-muted-foreground">
                  Course
                </th>
                <th className="hidden px-4 py-3 font-semibold text-muted-foreground sm:table-cell">
                  Price
                </th>
                <th className="hidden px-4 py-3 font-semibold text-muted-foreground md:table-cell">
                  Status
                </th>
                <th className="hidden px-4 py-3 font-semibold text-muted-foreground lg:table-cell">
                  Sections
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {courses.map((course) => (
                <tr key={course.id} className="group hover:bg-muted/20">
                  {/* Course column: thumbnail + title + description */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative hidden h-10 w-16 shrink-0 overflow-hidden rounded-md bg-muted sm:block">
                        {course.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={course.thumbnail_url}
                            alt={course.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <BookOpen className="h-4 w-4 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium leading-none">
                          {course.title}
                        </p>
                        {course.description && (
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {course.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {course.price === 0
                      ? "Free"
                      : new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: "INR",
                      }).format(course.price)}
                  </td>

                  {/* Status — clickable toggle */}
                  <td className="hidden px-4 py-3 md:table-cell">
                    <TogglePublishButton
                      courseId={course.id}
                      initialPublished={course.is_published}
                    />
                  </td>

                  {/* Sections count */}
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {course.sectionsCount}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/courses/${course.id}/edit`}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Link>
                      </Button>
                      <DeleteCourseDialog
                        courseId={course.id}
                        courseTitle={course.title}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
