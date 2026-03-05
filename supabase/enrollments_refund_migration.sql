-- ================================================================
-- FluxCode – Refund support for enrollments (72h window)
-- Run this in the Supabase SQL Editor.
-- ================================================================

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS purchased_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS razorpay_order_id text;

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text;

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS refund_requested_at timestamptz;

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS refund_status text;

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS refund_reason text;

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS razorpay_refund_id text;

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;
