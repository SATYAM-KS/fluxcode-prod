"use client";

import { useState, useTransition } from "react";
import { Shield, ShieldOff, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateUserRole, deleteUserEnrollments } from "./actions";

type User = {
  id: string;
  email: string;
  role: string;
  avatar_url: string | null;
  enrollment_count: number;
};

export function RoleManager({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  const [list, setList] = useState(users);
  const [pending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function toggleRole(user: User) {
    const newRole = user.role === "admin" ? "user" : "admin";
    setLoadingId(user.id + "_role");
    startTransition(async () => {
      try {
        await updateUserRole(user.id, newRole);
        setList((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u));
        toast.success(`${user.email} is now ${newRole === "admin" ? "an Admin" : "a User"}`);
      } catch (e: any) {
        toast.error("Failed to update role", { description: e?.message });
      } finally {
        setLoadingId(null);
      }
    });
  }

  async function removeEnrollments(user: User) {
    if (!confirm(`Remove all ${user.enrollment_count} enrollment(s) for ${user.email}?`)) return;
    setLoadingId(user.id + "_enroll");
    startTransition(async () => {
      try {
        await deleteUserEnrollments(user.id);
        setList((prev) => prev.map((u) => u.id === user.id ? { ...u, enrollment_count: 0 } : u));
        toast.success(`Enrollments removed for ${user.email}`);
      } catch (e: any) {
        toast.error("Failed to remove enrollments", { description: e?.message });
      } finally {
        setLoadingId(null);
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th className="px-4 py-3 font-semibold text-muted-foreground">User</th>
            <th className="hidden px-4 py-3 font-semibold text-muted-foreground sm:table-cell">Current Role</th>
            <th className="hidden px-4 py-3 font-semibold text-muted-foreground md:table-cell">Enrollments</th>
            <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {list.map((user) => (
            <tr key={user.id} className="hover:bg-muted/20">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar_url} alt={user.email} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {user.email[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                  <div>
                    <span className="font-medium truncate max-w-[180px] block">{user.email}</span>
                    {user.id === currentUserId && (
                      <span className="text-[10px] text-muted-foreground">You</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="hidden px-4 py-3 sm:table-cell">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                  user.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {user.role}
                </span>
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                {user.enrollment_count} course{user.enrollment_count !== 1 ? "s" : ""}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  {/* Role toggle — disabled for self */}
                  <button
                    onClick={() => toggleRole(user)}
                    disabled={user.id === currentUserId || loadingId === user.id + "_role"}
                    title={user.role === "admin" ? "Revoke admin" : "Make admin"}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                      user.role === "admin"
                        ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    }`}
                  >
                    {loadingId === user.id + "_role" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : user.role === "admin" ? (
                      <ShieldOff className="h-3.5 w-3.5" />
                    ) : (
                      <Shield className="h-3.5 w-3.5" />
                    )}
                    {user.role === "admin" ? "Revoke Admin" : "Make Admin"}
                  </button>

                  {/* Remove enrollments */}
                  {user.enrollment_count > 0 && (
                    <button
                      onClick={() => removeEnrollments(user)}
                      disabled={loadingId === user.id + "_enroll"}
                      title="Remove all enrollments"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-40"
                    >
                      {loadingId === user.id + "_enroll" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Remove Enrollments
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
