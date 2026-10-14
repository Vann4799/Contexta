-- 0013_llm_calls.sql
-- The cost ledger. Wave 5 Phase 3: every cost figure this product had ever shown was an
-- estimate derived from prompt characters, and the `usage` block the provider returns on every
-- completion was decoded and thrown away. This table keeps one row per LLM HTTP attempt with
-- what the provider itself reported, and one price-derived cost column.
--
-- The row count is per HTTP attempt, not per user click: a truncated answer retries once
-- (app/chat/llm.py) and a brief is a map-reduce of ~5 completions, so a click that cost 2
-- attempts must not be recorded as 1. A user's daily chat message can therefore write 1-2 rows,
-- a brief up to its window count, and this is a wider table than the feature list suggests.
-- That is the point -- the estimate was wrong by exactly that factor.
--
-- cost columns stay NULL when nothing was measured: the provider withheld `usage`, or no price
-- is configured for the model (app/core/config.py keys prices by model id). NULL, not 0, so the
-- difference between "free" and "unmeasured" survives the read path; the RPC reports both as
-- counters and a sum of no priced rows is null, so an unfounded zero can never masquerade as a
-- bill.
--
-- The API's write path does not fail a user's answer if this insert fails (it logs and
-- continues), and nothing reads it in a hot path.

create table if not exists public.llm_calls (
  id bigint generated always as identity primary key,
  -- On delete cascade: account deletion (app/services/account_deletion.py) already removes
  -- every other table holding what this user asked the model about, and a ledger with no
  -- natural key left behind -- only which model it cost money on -- is an orphan liability.
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null constraint llm_calls_purpose_check check (purpose in (
    'chat', 'brief', 'rewrite', 'embeddings'
  )),
  -- The model id the request went out with, not the gateway's echo of it, because the price is
  -- looked up on what was requested.
  model text not null,
  prompt_tokens integer check (prompt_tokens is null or prompt_tokens >= 0),
  completion_tokens integer check (completion_tokens is null or completion_tokens >= 0),
  -- Only reported when thinking is on. DeepSeek counts these inside completion_tokens, so they
  -- are never added to a cost here; this column exists so the reasoning share is auditable.
  reasoning_tokens integer check (reasoning_tokens is null or reasoning_tokens >= 0),
  -- numeric, not double precision: money that arrives as a float accumulates error across a
  -- sum over thousands of calls, and 8 decimals is the smallest unit this can carry.
  cost_usd numeric(14,8),
  -- 'prices' = these tokens times a configured price; 'provider' = the gateway's own figure.
  -- Two numbers of different trust in one column, labelled, is the minimum honest form.
  cost_basis text constraint llm_calls_cost_basis_check check (cost_basis in ('prices', 'provider')),
  -- One side null and the other not is a broken row, not a mid-measurement state.
  constraint llm_calls_cost_basis_priced_check check (
    (cost_usd is null) = (cost_basis is null)
  ),
  created_at timestamptz not null default now()
);

-- Every aggregate read scopes by owner and filters on a UTC window, so one composite index
-- covers both.
create index if not exists idx_llm_calls_user_created
  on public.llm_calls (user_id, created_at desc);
-- The worker's 90-day prune scans this, like api_request_logs before it.
create index if not exists idx_llm_calls_created_at
  on public.llm_calls (created_at);

alter table public.llm_calls enable row level security;

-- Deliberately no policies. api_request_logs needs one because the owner reads its own audit
-- trail through PostgREST with a browser token; here the browser token reads nothing -- the API
-- owns every access path (service role for the insert and for the RPC), and the only per-owner
-- read is llm_usage_summary() below. Enabling RLS without a policy means a leaked anon or
-- authenticated key selects zero rows, while a leaked service key -- which the worker already
-- carries on a public host -- still works.
--
-- The explicit revoke is not redundant with that. Postgres grants default table privileges to
-- PUBLIC in the public schema, so RLS alone still lets an authenticated role attempt an insert;
-- revoking closes the write path too, instead of leaving it to a policy that does not exist.
revoke all on table public.llm_calls from public, anon, authenticated;

-- Stated rather than inherited. Supabase's default privileges happen to grant the service role
-- access to new public tables, but a revoke from PUBLIC is exactly the kind of change that makes
-- a role depend on a default; and because the API swallows ledger write failures by design, an
-- insert that stops working here is invisible -- no 500, no log line the founder reads, just a
-- ledger that quietly stops growing. Verified against a scratch cluster: without this grant the
-- row insert and the RPC both fail with "permission denied for table llm_calls".
grant select, insert, delete on table public.llm_calls to service_role;
-- The identity column draws from its own sequence, which table privileges do not cover.
grant usage on sequence public.llm_calls_id_seq to service_role;

comment on column public.llm_calls.cost_usd is
  'Price-derived cost in USD, or the gateway figure when cost_basis = provider. NULL when the '
  'provider reported no usage or no price is configured; never an estimate from characters.';
comment on column public.llm_calls.cost_basis is
  'prices: tokens times a configured per-million rate. provider: the gateway reported this '
  'money itself. NULL when cost_usd is null.';
comment on column public.llm_calls.reasoning_tokens is
  'A subset of completion_tokens on DeepSeek, reported only when thinking is on. Not additive.';

-- One RPC for the whole report, like account_summary and billing_usage: PostgREST has no
-- GROUP BY, so per-day and per-purpose buckets are otherwise N round trips of raw rows, and a
-- 90-day window of them is a user's whole spend history downloaded to answer five numbers.
--
-- SECURITY INVOKER, like account_summary and billing_usage: the API calls it with the service
-- role, which already bypasses RLS, so what keeps one owner's totals away from another is the
-- p_user_id predicate -- not a security clause. The route passes the id resolved from the
-- caller's JWT and there is no request field that can override it. (The revoke below is what
-- stops anon and authenticated from calling it at all.)
--
-- Days are bucketed with `at time zone 'utc'` on both sides of every comparison, because a bare
-- ::date or ::timestamptz resolves through the session TimeZone and would silently move spend
-- between days if the project's timezone setting ever changed. The window floor and the bucket
-- boundaries are derived from the same expression, so they agree by construction.
create or replace function public.llm_usage_summary(p_user_id uuid, p_days integer)
returns jsonb
language sql
stable
-- Clamped rather than rejected, the way api_key_authorize clamps its quota arguments: this
-- function is reachable only through a route that validates 1..90 already, and a bug there must
-- not turn into a 100k-day generate_series.
set search_path = public, pg_temp
as $$
  with params as (
    select greatest(1, least(365, coalesce(p_days, 30))) as days
  ),
  window_start as (
    select date_trunc('day', now() at time zone 'utc')
      - make_interval(days => params.days - 1) as day_ts
    from params
  ),
  scoped as (
    select
      (llm_calls.created_at at time zone 'utc')::date as day,
      llm_calls.purpose,
      llm_calls.prompt_tokens,
      llm_calls.completion_tokens,
      llm_calls.reasoning_tokens,
      llm_calls.cost_usd
    from public.llm_calls, window_start
    where llm_calls.user_id = p_user_id
      -- timestamp AT TIME ZONE 'utc' reads the UTC wall clock as an instant, so this floor is
      -- the same moment day_series starts from however the session timezone is set.
      and llm_calls.created_at >= (window_start.day_ts at time zone 'utc')
  ),
  totals as (
    select
      count(*) as calls,
      count(*) filter (where prompt_tokens is null) as calls_without_tokens,
      count(*) filter (where cost_usd is null) as calls_unpriced,
      coalesce(sum(prompt_tokens), 0) as prompt_tokens,
      coalesce(sum(completion_tokens), 0) as completion_tokens,
      coalesce(sum(reasoning_tokens), 0) as reasoning_tokens,
      -- Stays null when no row in the window was priced, so an unpriced stretch reads as
      -- "unknown", not as a month of free model calls.
      sum(cost_usd) as cost_usd
    from scoped
  ),
  purpose_stats as (
    select
      purpose,
      count(*) as calls,
      coalesce(sum(prompt_tokens), 0) as prompt_tokens,
      coalesce(sum(completion_tokens), 0) as completion_tokens,
      coalesce(sum(reasoning_tokens), 0) as reasoning_tokens,
      sum(cost_usd) as cost_usd
    from scoped
    group by purpose
  ),
  day_stats as (
    select
      day,
      count(*) as calls,
      coalesce(sum(prompt_tokens), 0) as prompt_tokens,
      coalesce(sum(completion_tokens), 0) as completion_tokens,
      sum(cost_usd) as cost_usd
    from scoped
    group by day
  ),
  -- Every day in the window is a row even with no calls, so a chart draws a flat line instead
  -- of dropping the gap. Day 1 of 30 is 29 days back.
  day_series as (
    select day_bucket::date as day
    from window_start
    cross join lateral generate_series(
      window_start.day_ts,
      date_trunc('day', now() at time zone 'utc'),
      interval '1 day'
    ) as day_rows(day_bucket)
  )
  select jsonb_build_object(
    'days', params.days,
    'totals', jsonb_build_object(
      'calls', totals.calls,
      'calls_without_tokens', totals.calls_without_tokens,
      'calls_unpriced', totals.calls_unpriced,
      'prompt_tokens', totals.prompt_tokens,
      'completion_tokens', totals.completion_tokens,
      'reasoning_tokens', totals.reasoning_tokens,
      'cost_usd', totals.cost_usd
    ),
    -- Busiest purpose first, name as the tie-break, so the ordering is stable across reads the
    -- way the Python mirror sorts it.
    'by_purpose', coalesce((
      select jsonb_agg(jsonb_build_object(
        'purpose', purpose_stats.purpose,
        'calls', purpose_stats.calls,
        'prompt_tokens', purpose_stats.prompt_tokens,
        'completion_tokens', purpose_stats.completion_tokens,
        'reasoning_tokens', purpose_stats.reasoning_tokens,
        'cost_usd', purpose_stats.cost_usd
      ) order by purpose_stats.calls desc, purpose_stats.purpose)
      from purpose_stats
    ), '[]'::jsonb),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', to_char(day_series.day, 'YYYY-MM-DD'),
        'calls', coalesce(day_stats.calls, 0),
        'prompt_tokens', coalesce(day_stats.prompt_tokens, 0),
        'completion_tokens', coalesce(day_stats.completion_tokens, 0),
        'cost_usd', day_stats.cost_usd
      ) order by day_series.day)
      from day_series left join day_stats using (day)
    ), '[]'::jsonb)
  )
  from params, totals;
$$;

revoke all on function public.llm_usage_summary(uuid, integer) from public;
revoke all on function public.llm_usage_summary(uuid, integer) from anon;
revoke all on function public.llm_usage_summary(uuid, integer) from authenticated;
grant execute on function public.llm_usage_summary(uuid, integer) to service_role;
