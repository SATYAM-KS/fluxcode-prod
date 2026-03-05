import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { code, courseId } = body as { code: string; courseId: string };

    if (!code || !courseId) {
      return NextResponse.json({ error: "Missing code or courseId" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch coupon
    const { data: coupon, error } = await admin
      .from("coupons")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .maybeSingle();

    if (error || !coupon) {
      return NextResponse.json({ error: "Invalid coupon code" }, { status: 404 });
    }

    // Check expiry
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json({ error: "Coupon has expired" }, { status: 400 });
    }

    // Check usage limit
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      return NextResponse.json({ error: "Coupon usage limit reached" }, { status: 400 });
    }

    // Check if course-specific
    if (coupon.course_id && coupon.course_id !== courseId) {
      return NextResponse.json({ error: "Coupon not valid for this course" }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      discount_type: coupon.discount_type, // "percent" | "flat"
      discount_value: coupon.discount_value,
      code: coupon.code,
    });
  } catch (e: any) {
    console.error("[validate-coupon]", e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
