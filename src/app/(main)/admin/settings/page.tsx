import { Shield } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin-client";
import { createClient } from "@/lib/supabase/server";
import { RoleManager } from "./role-manager";

export const metadata = { title: "Settings – Admin | FluxCode" };

async function getUsersWithEnrollmentCounts() {
  const admin = createAdminClient();

  const [{ data: profiles }, { data: enrollments }] = await Promise.all([
    admin.from("profiles").select("id, email, role, avatar_url").order("created_at", { ascending: false }),
    admin.from("enrollments").select("user_id"),
  ]);

  const countMap: Record<string, number> = {};
  for (const e of enrollments ?? []) {
    countMap[e.user_id] = (countMap[e.user_id] ?? 0) + 1;
  }

  return (profiles ?? []).map((p) => ({
    ...p,
    enrollment_count: countMap[p.id] ?? 0,
  }));
}

export default async function AdminSettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const users = await getUsersWithEnrollmentCounts();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage platform configuration and user permissions.
        </p>
      </div>

      {/* User Role Management */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">User Role Management</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Promote users to admin or revoke admin privileges. You cannot change your own role.
        </p>
        <RoleManager users={users} currentUserId={user?.id ?? ""} />
      </section>
    </div>
  );
}
