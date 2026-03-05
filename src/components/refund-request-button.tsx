"use client";

import { useMemo, useState, useEffect, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
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
  onRefundRequested,
}: {
  courseId: string;
  purchasedAt: string | null;
  refundRequestedAt: string | null;
  refundStatus: string | null;
  refundedAt: string | null;
  onRefundRequested?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [requested, setRequested] = useState(!!refundRequestedAt);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<
    "Bought by mistake" | "Course not as expected" | "Payment issue" | "Other"
  >("Bought by mistake");
  const [otherReason, setOtherReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const deadline = useMemo(() => {
    if (!purchasedAt) return null;
    const p = new Date(purchasedAt);
    if (Number.isNaN(p.getTime())) return null;
    return p.getTime() + REFUND_WINDOW_HOURS * 60 * 60 * 1000;
  }, [purchasedAt]);

  const [msLeft, setMsLeft] = useState<number>(() =>
    deadline ? Math.max(0, deadline - Date.now()) : Infinity
  );

  useEffect(() => {
    if (!deadline) return;
    const tick = () => setMsLeft(Math.max(0, deadline - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const eligible = msLeft > 0;

  const countdown = useMemo(() => {
    if (msLeft === Infinity) return null;
    const totalSec = Math.floor(msLeft / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [msLeft]);

  const alreadyRefunded = !!refundedAt || refundStatus === "processed";

  if (!eligible || requested || alreadyRefunded) return null;

  const finalReason = reason === "Other" ? otherReason.trim() : reason;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="mt-3 w-full">
          Request Refund{countdown ? ` (${countdown})` : " (72h)"}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm refund</AlertDialogTitle>
          <AlertDialogDescription>
            Please select a reason for your refund. Our team will review your request and process the refund within 3–5 business days.
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

        {errorMsg && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            disabled={pending || !finalReason}
            onClick={() => {
              setErrorMsg(null);
              startTransition(async () => {
                try {
                  const resp = await fetch("/api/request-refund", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ courseId, reason: finalReason }),
                  });
                  const data = await resp.json();
                  if (!resp.ok) {
                    setErrorMsg(data?.error ?? "Refund failed");
                    return;
                  }
                  setRequested(true);
                  setOpen(false);
                  onRefundRequested?.();
                  setTimeout(() => {
                    toast.success("Refund request submitted! 🎉", {
                      description:
                        "Your request has been received. You will get your refund within 3–5 business days.",
                      duration: 8000,
                    });
                  }, 300);
                } catch {
                  setErrorMsg("Refund failed");
                }
              });
            }}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Refund
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
