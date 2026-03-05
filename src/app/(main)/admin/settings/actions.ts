"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/supabase/get-user-role";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const ok = await isAdmin(user.id);
  if (!ok) throw new Error("Forbidden");
  return user;
}

export async function updateUserRole(userId: string, role: "user" | "admin") {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/users");
}

export async function deleteUserEnrollments(userId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("enrollments")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/enrollments");
}
