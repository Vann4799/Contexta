-- Subscriptions table for billing/plan management
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  plan_tier text not null default 'free' check (plan_tier in ('free', 'pro', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'cancelled', 'past_due', 'trialing')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '30 days'),
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_stripe_customer_idx on public.subscriptions(stripe_customer_id) where stripe_customer_id is not null;
