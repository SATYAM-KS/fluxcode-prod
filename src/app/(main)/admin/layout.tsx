import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { ensureProfile } from "@/lib/supabase/ensure-profile";

export const metadata: Metadata = {
  title: "Admin – FluxCode",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/admin");

  const profile = await ensureProfile(user);

  if (profile.role !== "admin") redirect("/dashboard");

  return (
    <div className="fixed inset-0 z-[100] flex overflow-hidden bg-background">
      <AdminShell
        user={{
          email: user.email ?? "Admin",
          avatar_url: profile.avatar_url ?? null,
        }}
      >
        {children}
      </AdminShell>
    </div>
  );
}
