"use client";

import { useState } from "react";
import { RotateCcw, CheckCircle, Clock, CircleDot, XCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type RefundStatus = "requested" | "processed" | "failed" | string | null;

interface TimelineStep {
  label: string;
  description: string;
  state: "done" | "active" | "pending" | "failed";
  date?: string | null;
}

function buildTimeline(
  refundRequestedAt: string | null,
  refundStatus: RefundStatus,
  refundedAt: string | null
): TimelineStep[] {
  const isProcessed = refundStatus === "processed";
  const isFailed = refundStatus === "failed";
  const isUnderReview = refundStatus === "under_review";

  const fmt = (d: string | null) =>
    d
      ? new Date(d).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return [
    {
      label: "Refund Requested",
      description: "Your refund request has been received by our team.",
      state: refundRequestedAt ? "done" : "pending",
      date: fmt(refundRequestedAt),
    },
    {
      label: "Under Review",
      description: "Our team is reviewing your request and processing the refund.",
      state: isProcessed || isFailed
        ? "done"
        : isUnderReview
        ? "active"
        : refundRequestedAt
        ? "pending"
        : "pending",
      date: null,
    },
    {
      label: isFailed ? "Refund Failed" : "Refund Processed",
      description: isFailed
        ? "There was an issue processing your refund. Please contact support."
        : isProcessed
        ? "Your refund has been approved and initiated."
        : "Once approved, the refund will be initiated to your original payment method.",
      state: isFailed ? "failed" : isProcessed ? "done" : "pending",
      date: fmt(refundedAt),
    },
    {
      label: "Amount Credited",
      description: "Refund credited to your original payment method (3–5 business days).",
      state: isProcessed ? "active" : "pending",
      date: null,
    },
  ];
}

const STEP_ICON = {
  done: <CheckCircle className="h-5 w-5 text-green-500" />,
  active: <CircleDot className="h-5 w-5 text-primary animate-pulse" />,
  pending: <Clock className="h-5 w-5 text-muted-foreground/40" />,
  failed: <XCircle className="h-5 w-5 text-destructive" />,
};

const CONNECTOR_COLOR: Record<TimelineStep["state"], string> = {
  done: "bg-green-500",
  active: "bg-primary/40",
  pending: "bg-border",
  failed: "bg-destructive/40",
};

export function TrackRefundButton({
  refundRequestedAt,
  refundStatus,
  refundedAt,
}: {
  refundRequestedAt: string | null;
  refundStatus: RefundStatus;
  refundedAt: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (!refundRequestedAt) return null;

  const steps = buildTimeline(refundRequestedAt, refundStatus, refundedAt);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Track Refund
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" />
            Refund Status
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="mt-2 space-y-0">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-4">
              {/* Icon + connector */}
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                  {STEP_ICON[step.state]}
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-0.5 flex-1 ${CONNECTOR_COLOR[step.state]} mt-0.5 mb-0.5 min-h-[24px]`} />
                )}
              </div>

              {/* Content */}
              <div className={`pb-5 ${i === steps.length - 1 ? "pb-0" : ""}`}>
                <p
                  className={`text-sm font-semibold leading-8 ${
                    step.state === "failed"
                      ? "text-destructive"
                      : step.state === "pending"
                      ? "text-muted-foreground/50"
                      : "text-foreground"
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
                {step.date && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground/60">{step.date}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
