"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/* ─── Course save (create or update) ────────────────────────────── */

export async function saveCourseAction(payload: {
    id?: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    price: number;
    is_published: boolean;
}): Promise<{ error: string | null }> {
    const supabase = createClient();
    const { id, ...data } = payload;

    const { error } = id
        ? await supabase.from("courses").update(data).eq("id", id)
        : await supabase.from("courses").insert(data);

    if (error) return { error: error.message };

    // Invalidate both the listing and, if editing, the specific course page
    revalidatePath("/courses", "layout");
    if (id) revalidatePath(`/courses/${id}`, "layout");
    revalidatePath("/admin/courses", "layout");

    return { error: null };
}

/* ─── Toggle publish ─────────────────────────────────────────────── */

export async function togglePublishAction(
    courseId: string,
    isPublished: boolean
): Promise<{ error: string | null }> {
    const supabase = createClient();

    const { error } = await supabase
        .from("courses")
        .update({ is_published: isPublished })
        .eq("id", courseId);

    if (error) return { error: error.message };

    revalidatePath("/courses", "layout");
    revalidatePath(`/courses/${courseId}`, "layout");
    revalidatePath("/admin/courses", "layout");

    return { error: null };
}
