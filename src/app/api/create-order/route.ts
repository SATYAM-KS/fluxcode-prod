import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";

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
    const finalAmount = body?.finalAmount as number | undefined; // in rupees, after discount
    const couponCode = body?.couponCode as string | undefined;

    if (!courseId) {
      return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: course, error: courseError } = await admin
      .from("courses")
      .select("id, title, price, is_published")
      .eq("id", courseId)
      .single();

    if (courseError || !course || !course.is_published) {
      console.error("[create-order] course fetch error:", courseError?.message, { courseId, found: !!course, published: course?.is_published });
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Free course: short-circuit and create enrollment directly
    if (course.price === 0) {
      const { error: enrollError } = await supabase
        .from("enrollments")
        .insert({ user_id: user.id, course_id: course.id });

      if (enrollError) {
        return NextResponse.json(
          { error: enrollError.message },
          { status: 400 }
        );
      }

      return NextResponse.json({ free: true });
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

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    // Use client-supplied finalAmount (post GST + convenience fee - discount) if provided,
    // but clamp to at least ₹1 to avoid Razorpay rejecting zero-value orders.
    const chargeAmount = finalAmount && finalAmount > 0 ? finalAmount : course.price;
    const amountInPaise = Math.round(chargeAmount * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `${course.id.slice(0, 16)}_${user.id.slice(0, 16)}`,
      notes: {
        courseId: course.id,
        userId: user.id,
        couponCode: couponCode ?? "",
      },
    });

    return NextResponse.json({
      free: false,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      course: { id: course.id, title: course.title },
      user: { id: user.id, email: user.email },
    });
  } catch (e: any) {
    console.error("[create-order] unexpected error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
