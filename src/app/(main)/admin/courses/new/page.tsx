import type { Metadata } from "next";

import { CourseForm } from "@/components/admin/course-form";

export const metadata: Metadata = { title: "New Course – Admin | FluxCode" };

export default function NewCoursePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Course</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a new course for your platform.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <CourseForm />
      </div>
    </div>
  );
}
