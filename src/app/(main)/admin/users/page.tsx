import { Users, BookOpen } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";

export const metadata = { title: "Users – Admin | FluxCode" };

async function getUsers() {
  const supabase = createClient();

  const [{ data: profiles }, { data: allEnrollments }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, role, avatar_url, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("enrollments")
      .select("user_id, course_id"),
  ]);

  // Fetch course titles via admin client (bypasses RLS)
  const courseIds = [...new Set((allEnrollments ?? []).map((e: any) => e.course_id))];
  const adminClient = createAdminClient();
  const coursesResult = courseIds.length
    ? await adminClient.from("courses").select("id, title").in("id", courseIds)
    : { data: [], error: null };
  const { data: courses } = coursesResult;
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

  return (profiles ?? []).map((p) => ({
    ...p,
    enrollments: enrollmentsByUser[p.id] ?? [],
  }));
}

export default async function AdminUsersPage() {
  const users = await getUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {users.length} registered user{users.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">No users yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 font-semibold text-muted-foreground">User</th>
                <th className="hidden px-4 py-3 font-semibold text-muted-foreground sm:table-cell">Role</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Enrolled Courses</th>
                <th className="hidden px-4 py-3 font-semibold text-muted-foreground md:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user: any) => {
                const enrollments: { course_id: string; courses: { title: string } | null }[] =
                  user.enrollments ?? [];
                return (
                  <tr key={user.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.avatar_url}
                            alt={user.email}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {user.email[0]?.toUpperCase() ?? "?"}
                          </div>
                        )}
                        <span className="font-medium">{user.email}</span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          user.role === "admin"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {enrollments.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {enrollments.map((e) => (
                            <span
                              key={e.course_id}
                              className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400"
                            >
                              <BookOpen className="h-3 w-3" />
                              {e.courses?.title ?? "Unknown"}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {new Date(user.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
