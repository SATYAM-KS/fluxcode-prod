"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const REFUND_WINDOW_HOURS = 72;

export function RefundRequestButton({
  courseId,
  purchasedAt,
  refundRequestedAt,
}: {
  courseId: string;
  purchasedAt: string | null;
  refundRequestedAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [requested, setRequested] = useState(!!refundRequestedAt);

  const eligible = useMemo(() => {
    if (!purchasedAt) return false;
    const p = new Date(purchasedAt);
    if (Number.isNaN(p.getTime())) return false;
    const deadline = p.getTime() + REFUND_WINDOW_HOURS * 60 * 60 * 1000;
    return Date.now() <= deadline;
  }, [purchasedAt]);

  if (!eligible || requested) return null;

  return (
    <Button
      variant="outline"
      className="mt-3 w-full"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            const resp = await fetch("/api/request-refund", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ courseId }),
            });
            const data = await resp.json();
            if (!resp.ok) {
              toast.error("Refund request failed", { description: data?.error });
              return;
            }
            setRequested(true);
            toast.success("Refund requested", {
              description: "We received your request and will contact you shortly.",
            });
          } catch {
            toast.error("Refund request failed");
          }
        });
      }}
    >
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Request Refund (72h)
    </Button>
  );
}
