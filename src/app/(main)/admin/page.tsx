import Link from "next/link";
import { BookOpen, Users, TrendingUp, ChevronRight } from "lucide-react";
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
    { data: allEnrollments },
  ] = await Promise.all([
    supabase.from("courses").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("enrollments").select("*", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id, email, avatar_url, role, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("enrollments")
      .select("user_id, course_id"),
  ]);

  // Fetch course titles for all enrolled course_ids
  const courseIds = [...new Set((allEnrollments ?? []).map((e: any) => e.course_id))];
  const { data: courses } = courseIds.length
    ? await supabase.from("courses").select("id, title").in("id", courseIds)
    : { data: [] };
  const courseMap: Record<string, string> = {};
  for (const c of courses ?? []) courseMap[c.id] = c.title;

  // Merge enrollments into each profile
  const enrollmentsByUser: Record<string, { course_id: string; title: string }[]> = {};
  for (const e of allEnrollments ?? []) {
    if (!enrollmentsByUser[e.user_id]) enrollmentsByUser[e.user_id] = [];
    enrollmentsByUser[e.user_id].push({
      course_id: e.course_id,
      title: courseMap[e.course_id] ?? "Unknown",
    });
  }

  const signupsWithEnrollments = (recentSignups ?? []).map((p: any) => ({
    ...p,
    enrollments: enrollmentsByUser[p.id] ?? [],
  }));

  return {
    totalCourses: totalCourses ?? 0,
    totalUsers: totalUsers ?? 0,
    totalEnrollments: totalEnrollments ?? 0,
    recentSignups: signupsWithEnrollments,
  };
}

/* ─── Stat card ─────────────────────────────────────────────────── */

type StatCardProps = {
  title: string;
  value: number;
  icon: LucideIcon;
  iconClass: string;
  href: string;
};

function StatCard({ title, value, icon: Icon, iconClass, href }: StatCardProps) {
  return (
    <Link href={href} className="group block">
      <Card className="transition-colors hover:border-primary/50 hover:bg-card/80">
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
        <CardContent className="flex items-end justify-between">
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          <span className="flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            View all <ChevronRight className="h-3 w-3" />
          </span>
        </CardContent>
      </Card>
    </Link>
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
      href: "/admin/courses",
    },
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      iconClass: "text-violet-500",
      href: "/admin/users",
    },
    {
      title: "Total Enrollments",
      value: stats.totalEnrollments,
      icon: TrendingUp,
      iconClass: "text-green-500",
      href: "/admin/enrollments",
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
              {stats.recentSignups.map((profile: any) => {
                const enrollments: { course_id: string; courses: { title: string } | null }[] =
                  profile.enrollments ?? [];
                return (
                  <li key={profile.id} className="flex items-center justify-between gap-4 px-6 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {profile.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={profile.avatar_url}
                          alt={profile.email}
                          className="h-8 w-8 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {profile.email[0]?.toUpperCase() ?? "?"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium leading-none">{profile.email}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs capitalize text-muted-foreground">{profile.role}</span>
                          {enrollments.map((e) => (
                            <span
                              key={e.course_id}
                              className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400"
                            >
                              <BookOpen className="h-2.5 w-2.5" />
                              {e.courses?.title ?? "Unknown"}
                            </span>
                          ))}
                        </div>
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
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
