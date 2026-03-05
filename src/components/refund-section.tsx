"use client";

import { useState } from "react";
import { RefundRequestButton } from "@/components/refund-request-button";
import { TrackRefundButton } from "@/components/track-refund-button";

export function RefundSection({
  courseId,
  purchasedAt,
  refundRequestedAt: initialRefundRequestedAt,
  refundStatus: initialRefundStatus,
  refundedAt,
}: {
  courseId: string;
  purchasedAt: string | null;
  refundRequestedAt: string | null;
  refundStatus: string | null;
  refundedAt: string | null;
}) {
  const [refundRequestedAt, setRefundRequestedAt] = useState(initialRefundRequestedAt);
  const [refundStatus, setRefundStatus] = useState(initialRefundStatus);

  return (
    <>
      <RefundRequestButton
        courseId={courseId}
        purchasedAt={purchasedAt}
        refundRequestedAt={refundRequestedAt}
        refundStatus={refundStatus}
        refundedAt={refundedAt}
        onRefundRequested={() => {
          setRefundRequestedAt(new Date().toISOString());
          setRefundStatus("requested");
        }}
      />
      <TrackRefundButton
        refundRequestedAt={refundRequestedAt}
        refundStatus={refundStatus}
        refundedAt={refundedAt}
      />
    </>
  );
}
