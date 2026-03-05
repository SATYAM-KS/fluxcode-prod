"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CheckoutModal } from "@/components/checkout-modal";

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
  coursePrice,
}: {
  courseId: string;
  courseTitle: string;
  coursePrice: number;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const router = useRouter();

  // Called when user clicks "Enroll Now" — for free courses skip modal
  async function onClick() {
    // Preload Razorpay script in background while modal is open
    if (coursePrice > 0) loadRazorpayScript();

    if (coursePrice === 0) {
      setPaying(true);
      try {
        const resp = await fetch("/api/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId }),
        });
        const data = await resp.json();
        if (!resp.ok) { toast.error("Enrollment failed", { description: data?.error }); return; }
        toast.success("Enrolled successfully!");
        router.push(`/learn/${courseId}`);
        router.refresh();
      } finally {
        setPaying(false);
      }
      return;
    }
    // Paid course — open checkout modal
    setModalOpen(true);
  }

  // Called from modal after user confirms price breakdown
  async function onProceed(finalAmount: number, couponCode?: string) {
    setModalOpen(false);
    setPaying(true);

    try {
      // Run script load and order creation in parallel to minimise delay
      const [scriptOk, orderResp] = await Promise.all([
        loadRazorpayScript(),
        fetch("/api/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, finalAmount, couponCode }),
        }),
      ]);

      const data = await orderResp.json();

      if (!orderResp.ok) {
        toast.error("Unable to create order", { description: data?.error });
        return;
      }

      if (!scriptOk) {
        toast.error("Razorpay failed to load. Check your internet connection.");
        return;
      }

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "FluxCode",
        description: courseTitle,
        order_id: data.orderId,
        prefill: { email: data?.user?.email },
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
              toast.error("Payment verification failed", { description: verifyData?.error });
              return;
            }

            toast.success("Payment successful! Enrolled.");
            router.push(`/learn/${courseId}`);
            router.refresh();
          } catch {
            toast.error("Payment succeeded but verification failed");
          }
        },
        theme: { color: "#0f172a" },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (resp: any) {
        toast.error("Payment failed", {
          description: resp?.error?.description ?? "Please try again",
        });
      });
      rzp.open();
    } finally {
      setPaying(false);
    }
  }

  return (
    <>
      <Button size="lg" className="w-full" onClick={onClick} disabled={paying}>
        {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enroll Now
      </Button>

      <CheckoutModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        courseId={courseId}
        courseTitle={courseTitle}
        basePrice={coursePrice}
        onProceed={onProceed}
      />
    </>
  );
}

