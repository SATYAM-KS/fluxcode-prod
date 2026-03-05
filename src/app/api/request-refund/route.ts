import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";

const REFUND_WINDOW_HOURS = 72;

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const admin = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const courseId = body?.courseId as string | undefined;
    const reason = body?.reason as string | undefined;

    if (!courseId) {
      return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
    }

    const { data: enrollment, error: enrollmentError } = await admin
      .from("enrollments")
      .select("id, user_id, purchased_at, refund_requested_at, refund_status, refunded_at")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();

    if (enrollmentError) {
      return NextResponse.json({ error: enrollmentError.message }, { status: 400 });
    }

    if (!enrollment) {
      return NextResponse.json({ error: "Not enrolled" }, { status: 403 });
    }

    if (enrollment.refunded_at || enrollment.refund_status === "processed") {
      return NextResponse.json({ error: "Already refunded" }, { status: 400 });
    }

    if (enrollment.refund_requested_at && enrollment.refund_status === "requested") {
      return NextResponse.json({ error: "Refund already requested" }, { status: 400 });
    }

    const purchasedAt = enrollment.purchased_at ? new Date(enrollment.purchased_at) : null;
    if (!purchasedAt || Number.isNaN(purchasedAt.getTime())) {
      return NextResponse.json(
        { error: "Missing purchase timestamp — contact support" },
        { status: 400 }
      );
    }

    const deadline = purchasedAt.getTime() + REFUND_WINDOW_HOURS * 60 * 60 * 1000;
    if (Date.now() > deadline) {
      return NextResponse.json({ error: "Refund window expired" }, { status: 400 });
    }

    const { error: updateError } = await admin
      .from("enrollments")
      .update({
        refund_requested_at: new Date().toISOString(),
        refund_status: "requested",
        refund_reason: reason ?? null,
      })
      .eq("id", enrollment.id)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
