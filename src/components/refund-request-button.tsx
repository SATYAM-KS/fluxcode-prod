"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const REFUND_WINDOW_HOURS = 72;

export function RefundRequestButton({
  courseId,
  purchasedAt,
  refundRequestedAt,
  refundStatus,
  refundedAt,
}: {
  courseId: string;
  purchasedAt: string | null;
  refundRequestedAt: string | null;
  refundStatus: string | null;
  refundedAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [requested, setRequested] = useState(!!refundRequestedAt);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<
    "Bought by mistake" | "Course not as expected" | "Payment issue" | "Other"
  >("Bought by mistake");
  const [otherReason, setOtherReason] = useState("");

  const eligible = useMemo(() => {
    if (!purchasedAt) return false;
    const p = new Date(purchasedAt);
    if (Number.isNaN(p.getTime())) return false;
    const deadline = p.getTime() + REFUND_WINDOW_HOURS * 60 * 60 * 1000;
    return Date.now() <= deadline;
  }, [purchasedAt]);

  const alreadyRefunded = !!refundedAt || refundStatus === "processed";

  if (!eligible || requested || alreadyRefunded) return null;

  const finalReason = reason === "Other" ? otherReason.trim() : reason;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="mt-3 w-full">
          Request Refund (72h)
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm refund</AlertDialogTitle>
          <AlertDialogDescription>
            Please select a reason. After confirmation, we will automatically process the refund and revoke access to this course.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="refund-reason"
              checked={reason === "Bought by mistake"}
              onChange={() => setReason("Bought by mistake")}
            />
            Bought by mistake
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="refund-reason"
              checked={reason === "Course not as expected"}
              onChange={() => setReason("Course not as expected")}
            />
            Course not as expected
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="refund-reason"
              checked={reason === "Payment issue"}
              onChange={() => setReason("Payment issue")}
            />
            Payment issue
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="refund-reason"
              checked={reason === "Other"}
              onChange={() => setReason("Other")}
            />
            Other
          </label>

          {reason === "Other" && (
            <textarea
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              className="mt-2 w-full rounded-md border border-border bg-background p-2 text-sm"
              placeholder="Tell us why you want a refund"
              rows={3}
            />
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || !finalReason}
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                try {
                  const resp = await fetch("/api/request-refund", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ courseId, reason: finalReason }),
                  });
                  const data = await resp.json();
                  if (!resp.ok) {
                    toast.error("Refund failed", { description: data?.error });
                    return;
                  }
                  setRequested(true);
                  setOpen(false);
                  toast.success("Refund processed", {
                    description: "Your refund has been initiated successfully.",
                  });
                } catch {
                  toast.error("Refund failed");
                }
              });
            }}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Refund
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
