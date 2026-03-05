import { redirect } from "next/navigation";
import Image from "next/image";
import { User, Calendar, Award, BookOpen, CheckCircle2, LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatDateIST } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import { ensureProfile } from "@/lib/supabase/ensure-profile";

export const metadata = {
  title: "Profile – FluxCode",
  description: "Manage your account settings",
};

/* ─── Data fetching ─────────────────────────────────────────────── */

async function getUserStats(userId: string) {
  const supabase = createClient();

  const [{ count: enrollmentsCount }, { count: completedLessonsCount }] =
    await Promise.all([
      supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("user_progress").select("*", { count: "exact", head: true }).eq("user_id", userId),
    ]);

  return {
    enrollmentsCount: enrollmentsCount ?? 0,
    completedLessonsCount: completedLessonsCount ?? 0,
  };
}

/* ─── Page ──────────────────────────────────────────────────────── */

export default async function ProfilePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await ensureProfile(user);

  const stats = await getUserStats(user.id);

  const displayName = user.user_metadata?.full_name || profile?.email?.split("@")[0] || "User";
  const avatarUrl = user.user_metadata?.avatar_url || null;
  const memberSince = profile.created_at
    ? formatDateIST(profile.created_at, { month: "long", year: "numeric" })
    : "—";

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="mt-2 text-muted-foreground">Manage your account information</p>
      </div>

      <div className="space-y-6">
        {/* ─── Avatar & Identity ─────────────────────────────────── */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-6">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User className="h-10 w-10 text-muted-foreground/40" />
                </div>
              )}
            </div>

            <div className="flex-1">
              <h2 className="text-xl font-semibold">{displayName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{profile.email || user.email}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Member since {memberSince}
                </span>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium capitalize text-primary">
                  {profile.role || "user"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Stats ─────────────────────────────────────────────── */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Learning Stats
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.enrollmentsCount}</p>
                <p className="text-sm text-muted-foreground">Courses Enrolled</p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completedLessonsCount}</p>
                <p className="text-sm text-muted-foreground">Lessons Completed</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Certificates (placeholder) ────────────────────────── */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            My Certificates
          </h3>
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
            <Award className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              No certificates yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Complete courses to earn certificates
            </p>
          </div>
        </section>

        {/* ─── Danger Zone ───────────────────────────────────────── */}
        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-destructive">
            Danger Zone
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Sign Out</p>
              <p className="text-sm text-muted-foreground">
                Sign out of your account on this device
              </p>
            </div>
            <SignOutButton />
          </div>
        </section>
      </div>
    </main>
  );
}
