import { createAdminClient } from "@/lib/supabase/admin-client";
import { ApproveRefundButton } from "@/components/admin/approve-refund-button";
import { formatDateTimeIST } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getRefundRequests() {
  const admin = createAdminClient();

  const { data: enrollments } = await admin
    .from("enrollments")
    .select("id, user_id, course_id, purchased_at, refund_requested_at, refund_status, refund_reason, razorpay_payment_id, refunded_at")
    .not("refund_requested_at", "is", null)
    .order("refund_requested_at", { ascending: false });

  if (!enrollments || enrollments.length === 0) return [];

  const userIds = [...new Set(enrollments.map((e) => e.user_id))];
  const courseIds = [...new Set(enrollments.map((e) => e.course_id))];

  const [{ data: profiles }, { data: courses }] = await Promise.all([
    admin.from("profiles").select("id, email, full_name").in("id", userIds),
    admin.from("courses").select("id, title").in("id", courseIds),
  ]);

  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
  const courseMap = Object.fromEntries((courses ?? []).map((c: any) => [c.id, c]));

  return enrollments.map((e: any) => ({
    ...e,
    user: profileMap[e.user_id] ?? null,
    course: courseMap[e.course_id] ?? null,
  }));
}

const STATUS_STYLES: Record<string, string> = {
  requested: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  under_review: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  processed: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
  credited: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  under_review: "Under Review",
  processed: "Processed",
  credited: "Amount Credited",
  failed: "Failed",
};

export default async function AdminRefundsPage() {
  const refunds = await getRefundRequests();

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Refund Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {refunds.length} total refund request{refunds.length !== 1 ? "s" : ""}
        </p>
      </div>

      {refunds.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          No refund requests yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-semibold">User</th>
                <th className="px-4 py-3 text-left font-semibold">Course</th>
                <th className="px-4 py-3 text-left font-semibold">Reason</th>
                <th className="px-4 py-3 text-left font-semibold">Payment ID</th>
                <th className="px-4 py-3 text-left font-semibold">Requested At</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {refunds.map((r: any) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {r.user?.full_name ?? r.user?.email ?? "Unknown"}
                    </div>
                    {r.user?.full_name && (
                      <div className="text-xs text-muted-foreground">{r.user.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.course?.title ?? "Unknown course"}
                  </td>
                  <td className="max-w-[200px] px-4 py-3">
                    <span className="break-words text-muted-foreground">
                      {r.refund_reason ?? <span className="italic text-muted-foreground/50">—</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {r.razorpay_payment_id ?? <span className="italic">free course</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.refund_requested_at
                      ? formatDateTimeIST(r.refund_requested_at)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        STATUS_STYLES[r.refund_status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {STATUS_LABELS[r.refund_status] ?? (r.refund_status ?? "—")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.refund_status !== "credited" && r.refund_status !== "failed" && (
                      <ApproveRefundButton
                        enrollmentId={r.id}
                        initialStatus={r.refund_status}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
