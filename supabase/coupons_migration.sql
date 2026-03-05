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

-- Only admins can manage coupons (service role bypasses RLS)
create policy "Admins can manage coupons"
  on public.coupons
  for all
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Authenticated users can read active coupons (for validation UI)
create policy "Authenticated users can read coupons"
  on public.coupons
  for select
  to authenticated
  using (true);

-- Example seed coupon (remove or modify in production)
-- insert into public.coupons (code, discount_type, discount_value)
-- values ('LAUNCH50', 'percent', 50);
