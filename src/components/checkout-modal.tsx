"use client";

import { useState, useEffect, useRef } from "react";
import { X, Tag, Loader2, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const GST_RATE = 0.18;          // 18%
const CONVENIENCE_FEE_RATE = 0.02; // 2%

type CouponResult = {
  valid: boolean;
  discount_type: "percent" | "flat";
  discount_value: number;
  code: string;
};

function fmt(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function CheckoutModal({
  open,
  onClose,
  courseId,
  courseTitle,
  basePrice,
  onProceed,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  courseTitle: string;
  basePrice: number;
  onProceed: (finalAmount: number, couponCode?: string) => void;
}) {
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCouponInput("");
      setCouponResult(null);
      setCouponError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  // ── Price calculations ──────────────────────────────────────────
  let discountAmount = 0;
  if (couponResult?.valid) {
    if (couponResult.discount_type === "percent") {
      discountAmount = (basePrice * couponResult.discount_value) / 100;
    } else {
      discountAmount = Math.min(couponResult.discount_value, basePrice);
    }
  }

  const priceAfterDiscount = Math.max(0, basePrice - discountAmount);
  const gst = priceAfterDiscount * GST_RATE;
  const convenienceFee = priceAfterDiscount * CONVENIENCE_FEE_RATE;
  const totalAmount = priceAfterDiscount + gst + convenienceFee;

  // ── Coupon apply ────────────────────────────────────────────────
  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponError(null);
    setCouponResult(null);

    try {
      const resp = await fetch("/api/validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput.trim(), courseId }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setCouponError(data?.error ?? "Invalid coupon");
      } else {
        setCouponResult(data);
      }
    } catch {
      setCouponError("Failed to validate coupon");
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setCouponResult(null);
    setCouponError(null);
    setCouponInput("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-white">Order Summary</h2>
            <p className="mt-0.5 text-xs text-zinc-400 truncate max-w-[280px]">{courseTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Price breakdown */}
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between text-zinc-300">
              <span>Base price</span>
              <span>{fmt(basePrice)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-green-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  Coupon ({couponResult!.code})
                  {couponResult!.discount_type === "percent"
                    ? ` — ${couponResult!.discount_value}% off`
                    : ""}
                </span>
                <span>− {fmt(discountAmount)}</span>
              </div>
            )}

            <div className="border-t border-zinc-800 pt-3 space-y-2">
              <div className="flex items-center justify-between text-zinc-400">
                <span>GST (18%)</span>
                <span>{fmt(gst)}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Convenience fee (2%)</span>
                <span>{fmt(convenienceFee)}</span>
              </div>
            </div>

            <div className="border-t border-zinc-700 pt-3 flex items-center justify-between font-bold text-white text-base">
              <span>Total</span>
              <span className="text-primary text-lg">{fmt(totalAmount)}</span>
            </div>
          </div>

          {/* Coupon section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Coupon Code</p>
              <p className="text-xs text-zinc-400">
                Use <span
                  className="cursor-pointer font-mono font-bold text-green-400 hover:text-green-300 hover:underline"
                  onClick={() => { setCouponInput("LAUNCH25"); setCouponError(null); setCouponResult(null); }}
                >LAUNCH25</span> to get a discount
              </p>
            </div>

            {couponResult?.valid ? (
              <div className="flex items-center gap-3 rounded-lg border border-green-700 bg-green-950/40 px-4 py-2.5">
                <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                <span className="flex-1 text-sm font-semibold text-green-300 tracking-widest">{couponResult.code}</span>
                <button
                  onClick={removeCoupon}
                  className="text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={couponInput}
                  onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") applyCoupon(); }}
                  placeholder="Enter coupon code"
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono uppercase text-white placeholder:normal-case placeholder:font-sans placeholder:text-zinc-500 outline-none focus:border-primary transition-colors"
                />
                <button
                  onClick={applyCoupon}
                  disabled={!couponInput.trim() || couponLoading}
                  className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-600 disabled:opacity-40"
                >
                  {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                </button>
              </div>
            )}

            {couponError && (
              <div className="flex items-center gap-1.5 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {couponError}
              </div>
            )}
          </div>

          {/* Proceed button */}
          <button
            onClick={() => onProceed(totalAmount, couponResult?.code)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Pay {fmt(totalAmount)}
            <ChevronRight className="h-4 w-4" />
          </button>

          <p className="text-center text-[11px] text-zinc-500">
            Secured by Razorpay · 3-day money-back guarantee
          </p>
        </div>
      </div>
    </div>
  );
}
