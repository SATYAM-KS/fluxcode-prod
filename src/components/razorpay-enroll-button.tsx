"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function RazorpayEnrollButton({
  courseId,
  courseTitle,
}: {
  courseId: string;
  courseTitle: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onClick() {
    setLoading(true);
    try {
      const resp = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        toast.error("Unable to start checkout", { description: data?.error });
        return;
      }

      // Free course
      if (data.free) {
        toast.success("Enrolled successfully");
        router.push(`/learn/${courseId}`);
        router.refresh();
        return;
      }

      const ok = await loadRazorpayScript();
      if (!ok) {
        toast.error("Razorpay failed to load");
        return;
      }

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "FluxCode",
        description: courseTitle,
        order_id: data.orderId,
        prefill: {
          email: data?.user?.email,
        },
        handler: async function (response: any) {
          try {
            const verifyResp = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                courseId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyResp.json();

            if (!verifyResp.ok) {
              toast.error("Payment verification failed", {
                description: verifyData?.error,
              });
              return;
            }

            toast.success("Payment successful! Enrolled.");
            router.push(`/learn/${courseId}`);
            router.refresh();
          } catch {
            toast.error("Payment succeeded but verification failed");
          }
        },
        theme: {
          color: "#0f172a",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (resp: any) {
        toast.error("Payment failed", {
          description: resp?.error?.description ?? "Please try again",
        });
      });
      rzp.open();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="lg" className="w-full" onClick={onClick} disabled={loading}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      Enroll Now
    </Button>
  );
}
