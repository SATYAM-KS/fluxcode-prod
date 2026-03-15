"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getDeviceFingerprint } from "@/lib/fingerprint";

export function DirectEnrollButton({
  courseId,
}: {
  courseId: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onClick() {
    setLoading(true);
    try {
      // Get device fingerprint from browser signals
      let fingerprint: string | undefined;
      try {
        fingerprint = await getDeviceFingerprint();
      } catch {
        // If fingerprinting fails, proceed but server won't enforce device limit
        fingerprint = undefined;
      }

      const resp = await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, fingerprint }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        if (data?.limitReached) {
          toast.error("Device enrollment limit reached", {
            description: data.error,
          });
        } else {
          toast.error("Enrollment failed", { description: data?.error });
        }
        return;
      }

      toast.success("Enrolled successfully! Welcome aboard 🎉");
      router.push(`/learn/${courseId}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="lg" className="w-full" onClick={onClick} disabled={loading}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      Enroll Now — Free
    </Button>
  );
}
