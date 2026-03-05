"use client";

import { useState, useTransition } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ApproveRefundButton({ enrollmentId }: { enrollmentId: string }) {
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-500">
        <CheckCircle className="h-3.5 w-3.5" />
        Approved
      </span>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            const resp = await fetch("/api/approve-refund", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ enrollmentId }),
            });
            const data = await resp.json();
            if (!resp.ok) {
              toast.error("Approval failed", { description: data?.error });
              return;
            }
            setDone(true);
            toast.success("Refund approved");
            router.refresh();
          } catch {
            toast.error("Approval failed");
          }
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-600 transition-colors hover:bg-green-500/20 disabled:opacity-50 dark:text-green-400"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
      Approve
    </button>
  );
}
