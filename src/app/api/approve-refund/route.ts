import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { isAdmin } from "@/lib/supabase/get-user-role";

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

    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const enrollmentId = body?.enrollmentId as string | undefined;
    const status = body?.status as string | undefined;

    if (!enrollmentId) {
      return NextResponse.json({ error: "Missing enrollmentId" }, { status: 400 });
    }

    const ALLOWED = ["under_review", "processed"];
    if (!status || !ALLOWED.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updatePayload: Record<string, any> = { refund_status: status };
    if (status === "processed") {
      updatePayload.refunded_at = new Date().toISOString();
    }

    const { error } = await admin
      .from("enrollments")
      .update(updatePayload)
      .eq("id", enrollmentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
