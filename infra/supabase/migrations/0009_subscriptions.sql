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

alter table public.subscriptions enable row level security;

-- Defense in depth only. The API talks to PostgREST with the service-role key, which
-- bypasses RLS entirely; this policy exists so that a browser-supplied access token
-- can never read another user's plan or Stripe identifiers. Writes stay service-role
-- only because there is no insert/update/delete policy.
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);
