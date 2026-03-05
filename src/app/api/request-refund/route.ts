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
      .select(
        "id, user_id, course_id, purchased_at, refund_requested_at, refund_status, refunded_at, razorpay_payment_id"
      )
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

    if (enrollment.refund_requested_at) {
      return NextResponse.json({ error: "Refund already requested" }, { status: 400 });
    }

    const purchasedAt = enrollment.purchased_at ? new Date(enrollment.purchased_at) : null;
    if (!purchasedAt || Number.isNaN(purchasedAt.getTime())) {
      return NextResponse.json(
        { error: "Missing purchase timestamp" },
        { status: 400 }
      );
    }

    const now = Date.now();
    const deadline = purchasedAt.getTime() + REFUND_WINDOW_HOURS * 60 * 60 * 1000;

    if (now > deadline) {
      return NextResponse.json(
        { error: "Refund window expired" },
        { status: 400 }
      );
    }

    // Mark request (for audit) + store reason
    const { error: markError } = await admin
      .from("enrollments")
      .update({
        refund_requested_at: new Date().toISOString(),
        refund_status: "requested",
        refund_reason: reason ?? null,
      })
      .eq("id", enrollment.id)
      .eq("user_id", user.id);

    if (markError) {
      return NextResponse.json({ error: markError.message }, { status: 400 });
    }

    // Free course (no payment id): mark refunded and revoke access immediately
    if (!enrollment.razorpay_payment_id) {
      const { error: updateFreeError } = await admin
        .from("enrollments")
        .update({
          refund_status: "processed",
          refunded_at: new Date().toISOString(),
        })
        .eq("id", enrollment.id)
        .eq("user_id", user.id);

      if (updateFreeError) {
        return NextResponse.json({ error: updateFreeError.message }, { status: 400 });
      }

      return NextResponse.json({ ok: true, refunded: false, revoked: true });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Missing Razorpay env vars" },
        { status: 500 }
      );
    }

    const { default: Razorpay } = await import("razorpay");
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    // Full refund (amount omitted). Razorpay requires a unique receipt sometimes; we'll provide notes.
    let refund: any;
    try {
      refund = await razorpay.payments.refund(enrollment.razorpay_payment_id, {
        notes: {
          courseId,
          userId: user.id,
          reason: reason ?? "",
        },
      });
    } catch (e: any) {
      // Mark failed
      await admin
        .from("enrollments")
        .update({ refund_status: "failed" })
        .eq("id", enrollment.id)
        .eq("user_id", user.id);

      return NextResponse.json(
        { error: e?.error?.description ?? e?.message ?? "Refund failed" },
        { status: 400 }
      );
    }

    // Record success and revoke access (keep row for audit)
    const { error: updatePaidError } = await admin
      .from("enrollments")
      .update({
        refund_status: "processed",
        razorpay_refund_id: refund?.id ?? null,
        refunded_at: new Date().toISOString(),
      })
      .eq("id", enrollment.id)
      .eq("user_id", user.id);

    if (updatePaidError) {
      return NextResponse.json(
        { error: "Refund processed, but audit update failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, refunded: true, refundId: refund?.id ?? null, revoked: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
