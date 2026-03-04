import { BookOpen, Users, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ─── Data fetching ─────────────────────────────────────────────── */

async function getAdminStats() {
  const supabase = createClient();

  const [
    { count: totalCourses },
    { count: totalUsers },
    { count: totalEnrollments },
    { data: recentSignups },
  ] = await Promise.all([
    supabase.from("courses").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("enrollments").select("*", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id, email, avatar_url, role, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  return {
    totalCourses: totalCourses ?? 0,
    totalUsers: totalUsers ?? 0,
    totalEnrollments: totalEnrollments ?? 0,
    recentSignups: recentSignups ?? [],
  };
}

/* ─── Stat card ─────────────────────────────────────────────────── */

type StatCardProps = {
  title: string;
  value: number;
  icon: LucideIcon;
  iconClass: string;
};

function StatCard({ title, value, icon: Icon, iconClass }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full bg-current/10 ${iconClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

/* ─── Page ──────────────────────────────────────────────────────── */

export default async function AdminDashboardPage() {
  const stats = await getAdminStats();

  const statCards: StatCardProps[] = [
    {
      title: "Total Courses",
      value: stats.totalCourses,
      icon: BookOpen,
      iconClass: "text-blue-500",
    },
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      iconClass: "text-violet-500",
    },
    {
      title: "Total Enrollments",
      value: stats.totalEnrollments,
      icon: TrendingUp,
      iconClass: "text-green-500",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your FluxCode platform.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      {/* Recent signups */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Recent Signups
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stats.recentSignups.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No users yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {stats.recentSignups.map((profile: {
                id: string;
                email: string;
                avatar_url: string | null;
                role: string;
                created_at: string;
              }) => (
                <li
                  key={profile.id}
                  className="flex items-center justify-between px-6 py-3"
                >
                  <div className="flex items-center gap-3">
                    {profile.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.avatar_url}
                        alt={profile.email}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {profile.email[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium leading-none">
                        {profile.email}
                      </p>
                      <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                        {profile.role}
                      </p>
                    </div>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {new Date(profile.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
