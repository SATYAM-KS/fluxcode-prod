import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { CourseForm } from "@/components/admin/course-form";
import { SectionsManager } from "@/components/admin/sections-manager";

export const metadata: Metadata = { title: "Edit Course – Admin | FluxCode" };

export default async function EditCoursePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const [{ data: course }, { data: sectionsRaw }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, description, thumbnail_url, price, is_published")
      .eq("id", params.id)
      .single(),
    supabase
      .from("sections")
      .select("id, title, order_index, lessons(id, title, order_index)")
      .eq("course_id", params.id)
      .order("order_index"),
  ]);

  if (!course) notFound();

  const sections = (sectionsRaw ?? []).map((s: any) => ({
    id: s.id as string,
    title: s.title as string,
    order_index: s.order_index as number,
    lessons: [...((s.lessons as any[]) ?? [])].sort(
      (a, b) => a.order_index - b.order_index
    ),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Course</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update details for{" "}
          <span className="font-medium text-foreground">{course.title}</span>.
        </p>
      </div>

      {/* Course details form */}
      <div className="rounded-xl border border-border bg-card p-6">
        <CourseForm
          initialData={{
            id: course.id,
            title: course.title,
            description: course.description,
            thumbnail_url: course.thumbnail_url,
            price: course.price,
            is_published: course.is_published,
          }}
        />
      </div>

      {/* Sections manager */}
      <div className="rounded-xl border border-border bg-card p-6">
        <SectionsManager courseId={params.id} initialSections={sections} />
      </div>
    </div>
  );
}
