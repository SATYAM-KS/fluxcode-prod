-- Coupons table for discount codes
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent', 'flat')),
  discount_value numeric(10, 2) not null check (discount_value > 0),
  course_id uuid references public.courses(id) on delete cascade, -- null = valid for all courses
  max_uses integer default null,  -- null = unlimited
  used_count integer not null default 0,
  expires_at timestamptz default null,  -- null = never expires
  created_at timestamptz not null default now()
);

-- RLS
alter table public.coupons enable row level security;

-- Authenticated users can read coupons (needed for client-side validation)
create policy "Authenticated users can read coupons"
  on public.coupons
  for select
  to authenticated
  using (true);

-- Coupon inserts/updates/deletes are handled via service role (admin API) only

-- Example seed coupon (remove or modify in production)
-- insert into public.coupons (code, discount_type, discount_value)
-- values ('LAUNCH50', 'percent', 50);
