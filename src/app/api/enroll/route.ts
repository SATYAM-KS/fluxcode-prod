import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { isAdmin } from "@/lib/supabase/get-user-role";

/** Max enrollments allowed per device in a rolling 30-day window */
const DEVICE_MONTHLY_LIMIT = 2;

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const courseId = body?.courseId as string | undefined;
    const fingerprint = body?.fingerprint as string | undefined;

    if (!courseId) {
      return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Verify course exists and is published
    const { data: course, error: courseError } = await admin
      .from("courses")
      .select("id, title, is_published")
      .eq("id", courseId)
      .single();

    if (courseError || !course || !course.is_published) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // 2. Check if already enrolled
    const { data: existing } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Already enrolled in this course" },
        { status: 409 }
      );
    }

    // 3. Device fingerprint limit check (skip for admins)
    const adminUser = await isAdmin(user.id);

    if (!adminUser && fingerprint) {
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      const { count, error: fpError } = await admin
        .from("device_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("fingerprint", fingerprint)
        .gte("enrolled_at", thirtyDaysAgo);

      if (fpError) {
        console.error("[enroll] device_enrollments query error:", fpError.message);
        // Non-fatal: continue without blocking
      } else if ((count ?? 0) >= DEVICE_MONTHLY_LIMIT) {
        return NextResponse.json(
          {
            error: `This device has reached the limit of ${DEVICE_MONTHLY_LIMIT} course enrollments per month. Try again next month.`,
            limitReached: true,
          },
          { status: 429 }
        );
      }
    }

    // 4. Create enrollment
    const { error: enrollError } = await supabase
      .from("enrollments")
      .insert({ user_id: user.id, course_id: courseId });

    if (enrollError) {
      return NextResponse.json(
        { error: enrollError.message },
        { status: 400 }
      );
    }

    // 5. Record device fingerprint (non-blocking)
    if (fingerprint) {
      await admin.from("device_enrollments").insert({
        fingerprint,
        user_id: user.id,
        course_id: courseId,
        enrolled_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[enroll] unexpected error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
