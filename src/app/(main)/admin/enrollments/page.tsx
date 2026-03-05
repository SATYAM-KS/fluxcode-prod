import { TrendingUp, BookOpen } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";

export const metadata = { title: "Enrollments – Admin | FluxCode" };

async function getEnrollments() {
  const supabase = createClient();

  const [{ data: allEnrollments }, { data: profiles }] = await Promise.all([
    supabase.from("enrollments").select("user_id, course_id"),
    supabase.from("profiles").select("id, email, avatar_url, role"),
  ]);

  // Get unique course ids and fetch titles via admin client (bypasses RLS)
  const courseIds = [...new Set((allEnrollments ?? []).map((e: any) => e.course_id))];
  const adminClient = createAdminClient();
  const { data: courses } = courseIds.length
    ? await adminClient.from("courses").select("id, title").in("id", courseIds)
    : { data: [] };

  const courseMap: Record<string, string> = {};
  for (const c of courses ?? []) courseMap[c.id] = c.title;

  const profileMap: Record<string, { email: string; avatar_url: string | null }> = {};
  for (const p of profiles ?? []) profileMap[p.id] = { email: p.email, avatar_url: p.avatar_url };

  return (allEnrollments ?? []).map((e: any) => ({
    user_id: e.user_id,
    course_id: e.course_id,
    email: profileMap[e.user_id]?.email ?? "Unknown",
    avatar_url: profileMap[e.user_id]?.avatar_url ?? null,
    course_title: courseMap[e.course_id] ?? "Unknown",
  }));
}

export default async function AdminEnrollmentsPage() {
  const enrollments = await getEnrollments();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Enrollments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {enrollments.length} total enrollment{enrollments.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {enrollments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <TrendingUp className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">No enrollments yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 font-semibold text-muted-foreground">User</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Course</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {enrollments.map((e, i) => (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {e.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.avatar_url}
                          alt={e.email}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {e.email[0]?.toUpperCase() ?? "?"}
                        </div>
                      )}
                      <span className="font-medium">{e.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400">
                      <BookOpen className="h-3 w-3" />
                      {e.course_title}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
