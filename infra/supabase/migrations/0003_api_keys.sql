-- 0003_api_keys.sql
-- T7: machine credentials for the public /v1 read surface, plus a per-request audit log.
--
-- Keys are stored as a SHA-256 digest of a 26-character secrets.token_urlsafe secret
-- (~154 bits of entropy), not bcrypt. The hot path compares this hash once per request
-- on every call; bcrypt would add ~100 ms to each one and its slowness buys nothing here,
-- because bcrypt only helps against guessing, and a 154-bit random secret is unguessable
-- regardless of the work factor. Consequence: the plaintext is unrecoverable, so it is
-- shown exactly once at creation and never stored.

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  key_hash char(64) not null unique,
  -- Display-only fragments so the owner can tell keys apart without the secret.
  key_prefix text not null,
  last_four text not null check (char_length(last_four) = 4),
  -- Empty array means "every document in the workspace". Element ownership is validated
  -- by the API on create, not by a constraint: Postgres cannot express a foreign key on
  -- the elements of an array.
  document_ids uuid[] not null default '{}'::uuid[],
  scopes text[] not null default '{retrieve}'::text[],
  revoked_at timestamptz,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.api_request_logs (
  id bigint generated always as identity primary key,
  -- Both null for outcome 'invalid': a bad key maps to no owner.
  key_id uuid references public.api_keys(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  outcome text not null check (outcome in (
    'allowed', 'quota_minute', 'quota_day', 'revoked', 'expired', 'invalid'
  )),
  status_code integer not null,
  -- Filled in after the response is produced, hence nullable.
  latency_ms integer,
  document_ids_hit uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now()
);

create index if not exists idx_api_keys_user_id
  on public.api_keys (user_id, created_at desc);
create index if not exists idx_api_logs_key_created
  on public.api_request_logs (key_id, created_at desc);
create index if not exists idx_api_logs_user_created
  on public.api_request_logs (user_id, created_at desc);
-- The worker's 90-day prune scans this.
create index if not exists idx_api_logs_created_at
  on public.api_request_logs (created_at);

alter table public.api_keys enable row level security;
alter table public.api_request_logs enable row level security;

-- Defense in depth only. The API talks to PostgREST with the service-role key, which
-- bypasses RLS entirely; these policies exist so that a browser-supplied access token
-- can never list or write another user's keys or audit trail.
drop policy if exists "api_keys_select_own" on public.api_keys;
create policy "api_keys_select_own" on public.api_keys
  for select using (auth.uid() = user_id);
drop policy if exists "api_keys_insert_own" on public.api_keys;
create policy "api_keys_insert_own" on public.api_keys
  for insert with check (auth.uid() = user_id);
drop policy if exists "api_keys_update_own" on public.api_keys;
create policy "api_keys_update_own" on public.api_keys
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "api_logs_select_own" on public.api_request_logs;
create policy "api_logs_select_own" on public.api_request_logs
  for select using (auth.uid() = user_id);

-- One round trip per request: lock the key row, decide the outcome from the audit
-- history, record it, and bump last_used_at.
--
-- This has to be a single function because the API only reaches Postgres through
-- PostgREST HTTP, where a count-then-insert pair is not atomic. Two concurrent requests
-- would both read "99 used" and both allow a 100th, silently overrunning the day quota.
-- There is no Redis in this deployment to hold the counters, so Postgres is the arbiter.
-- The FOR UPDATE lock serializes requests for one key; different keys never contend.
--
-- Returns the decision plus the log row id, so the caller can come back and attach
-- latency and the documents actually hit once the retrieval is done.
create or replace function public.api_key_authorize(
  p_key_hash char(64),
  p_minute_limit integer,
  p_day_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  key_record public.api_keys%ROWTYPE;
  log_id bigint;
  used_minute integer := 0;
  used_day integer := 0;
  outcome text;
  status_code integer;
  result jsonb;
begin
  select * into key_record
  from public.api_keys
  where key_hash = p_key_hash
  for update;

  if not found then
    -- Deliberately indistinguishable from other failures at the API boundary: the
    -- response must not reveal whether a hash exists.
    insert into public.api_request_logs (key_id, user_id, outcome, status_code)
    values (null, null, 'invalid', 401)
    returning id into log_id;

    return jsonb_build_object(
      'key_id', null, 'user_id', null, 'document_ids', '[]'::jsonb,
      'scopes', '[]'::jsonb, 'outcome', 'invalid', 'status_code', 401,
      'remaining_minute', 0, 'remaining_day', 0, 'log_id', log_id
    );
  end if;

  if key_record.revoked_at is not null then
    outcome := 'revoked';
    status_code := 403;
  elsif key_record.expires_at is not null and key_record.expires_at <= now() then
    outcome := 'expired';
    status_code := 403;
  else
    select
      count(*) filter (
        where created_at >= date_trunc('minute', now())
      ),
      count(*) filter (
        where created_at >= date_trunc('day', now())
      )
    into used_minute, used_day
    from public.api_request_logs
    where api_request_logs.key_id = key_record.id
      and outcome = 'allowed';

    if used_minute >= p_minute_limit then
      outcome := 'quota_minute';
      status_code := 429;
    elsif used_day >= p_day_limit then
      outcome := 'quota_day';
      status_code := 429;
    else
      outcome := 'allowed';
      status_code := 200;
    end if;
  end if;

  -- The rejected request is logged too, so the owner's usage page shows attempts,
  -- not only successes; an attacker hammering one key is visible.
  insert into public.api_request_logs (key_id, user_id, outcome, status_code)
  values (
    key_record.id,
    key_record.user_id,
    outcome,
    status_code
  )
  returning id into log_id;

  if outcome = 'allowed' then
    update public.api_keys
    set last_used_at = now()
    where id = key_record.id;
  end if;

  result := jsonb_build_object(
    'key_id', key_record.id,
    'user_id', key_record.user_id,
    'document_ids', coalesce(to_jsonb(key_record.document_ids), '[]'::jsonb),
    'scopes', coalesce(to_jsonb(key_record.scopes), '[]'::jsonb),
    'outcome', outcome,
    'status_code', status_code,
    'remaining_minute', greatest(p_minute_limit - (used_minute + 1), 0),
    'remaining_day', greatest(p_day_limit - (used_day + 1), 0),
    'log_id', log_id
  );

  return result;
end;
$$;

-- Only the API's service role may call this. It is SECURITY DEFINER and writes across
-- every owner's rows, so exposing it to anon/authenticated would let a browser mint or
-- probe key hashes directly.
revoke all on function public.api_key_authorize(char(64), integer, integer) from public;
revoke all on function public.api_key_authorize(char(64), integer, integer) from anon;
revoke all on function public.api_key_authorize(char(64), integer, integer) from authenticated;
grant execute on function public.api_key_authorize(char(64), integer, integer) to service_role;

-- The owner's usage panel needs about 14 numbers. PostgREST has no GROUP BY, so the
-- alternative is fetching every raw log row for the window and counting it in Python,
-- which for an active key is thousands of rows per page load.
--
-- SECURITY INVOKER, unlike api_key_authorize: this only reads one key's audit history,
-- it writes nothing, and it crosses no ownership boundary that RLS does not already hold.
create or replace function public.api_key_usage(p_key_id uuid, p_days integer)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'key_id', p_key_id,
    'days', p_days,
    'total', count(*),
    'allowed', count(*) filter (where outcome = 'allowed'),
    'rejected', count(*) filter (where outcome <> 'allowed'),
    'by_outcome', jsonb_object_agg(outcome, counted.total) ,
    'by_day', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'date', to_char(d.day, 'YYYY-MM-DD'),
            'allowed', coalesce(day_stats.allowed, 0),
            'rejected', coalesce(day_stats.rejected, 0)
          )
          order by d.day
        ),
        '[]'::jsonb
      )
      from (
        select generate_series(
          date_trunc('day', now()) - make_interval(days => p_days - 1),
          date_trunc('day', now()),
          interval '1 day'
        )::date as day
      ) d
      left join (
        select
          created_at::date as day,
          count(*) filter (where outcome = 'allowed') as allowed,
          count(*) filter (where outcome <> 'allowed') as rejected
        from public.api_request_logs
        where key_id = p_key_id
        group by 1
      ) day_stats on day_stats.day = d.day
    )
  )
  from (
    select outcome, count(*) as total
    from public.api_request_logs
    where key_id = p_key_id
    group by outcome
  ) counted
$$;

revoke all on function public.api_key_usage(uuid, integer) from public;
revoke all on function public.api_key_usage(uuid, integer) from anon;
revoke all on function public.api_key_usage(uuid, integer) from authenticated;
grant execute on function public.api_key_usage(uuid, integer) to service_role;
