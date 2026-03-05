"use client";

import { useState, useTransition } from "react";
import { CheckCircle, Clock, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Stage = "requested" | "under_review" | "processed" | "credited" | string;

async function updateRefundStatus(enrollmentId: string, status: string) {
  const resp = await fetch("/api/approve-refund", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enrollmentId, status }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error ?? "Failed");
  return data;
}

export function RefundActionsCell({
  enrollmentId,
  initialStatus,
}: {
  enrollmentId: string;
  initialStatus: Stage;
}) {
  const [status, setStatus] = useState<Stage>(initialStatus);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function move(next: Stage, label: string) {
    startTransition(async () => {
      try {
        await updateRefundStatus(enrollmentId, next);
        setStatus(next);
        toast.success(`Refund marked as ${label}`);
        router.refresh();
      } catch (e: any) {
        toast.error("Action failed", { description: e.message });
      }
    });
  }

  if (status === "credited") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-500">
        <CheckCircle className="h-3.5 w-3.5" />
        Amount Credited
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {status === "requested" && (
        <button
          disabled={pending}
          onClick={() => move("under_review", "Under Review")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-500/20 disabled:opacity-50 dark:text-blue-400"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          Mark Under Review
        </button>
      )}
      {(status === "requested" || status === "under_review") && (
        <button
          disabled={pending}
          onClick={() => move("processed", "Processed")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-600 transition-colors hover:bg-green-500/20 disabled:opacity-50 dark:text-green-400"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
          Mark Processed
        </button>
      )}
      {status === "processed" && (
        <button
          disabled={pending}
          onClick={() => move("credited", "Amount Credited")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-400"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
          Mark Amount Credited
        </button>
      )}
    </div>
  );
}

export { RefundActionsCell as ApproveRefundButton };
