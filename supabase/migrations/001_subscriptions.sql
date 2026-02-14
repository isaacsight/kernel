-- Subscriptions table: tracks Stripe subscription status per user
-- Run this in Supabase Dashboard → SQL Editor

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive' check (status in ('active', 'canceled', 'past_due', 'inactive')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One subscription per user
create unique index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);

-- Index for webhook lookups by stripe subscription id
create index if not exists subscriptions_stripe_sub_idx on public.subscriptions(stripe_subscription_id);

-- Enable RLS
alter table public.subscriptions enable row level security;

-- Users can only read their own subscription
create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Only service_role (edge functions) can insert/update/delete
-- No insert/update/delete policies for authenticated users means
-- only service_role key bypasses RLS and can write.
