import { NextResponse } from "next/server";
import crypto from "crypto";

import { createClient } from "@/lib/supabase/server";

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
    const razorpay_order_id = body?.razorpay_order_id as string | undefined;
    const razorpay_payment_id = body?.razorpay_payment_id as string | undefined;
    const razorpay_signature = body?.razorpay_signature as string | undefined;

    if (!courseId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Missing Razorpay secret" },
        { status: 500 }
      );
    }

    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Insert enrollment (idempotent-ish: ignore duplicate via unique constraint if present)
    const { error: enrollError } = await supabase
      .from("enrollments")
      .insert({
        user_id: user.id,
        course_id: courseId,
        purchased_at: new Date().toISOString(),
        razorpay_order_id,
        razorpay_payment_id,
      });

    if (enrollError) {
      return NextResponse.json(
        { error: enrollError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
