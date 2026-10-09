-- 0005_api_key_authorize_fix.sql
-- The original api_key_authorize returned remaining_minute/remaining_day computed from
-- used_minute/used_day even for revoked, expired, and quota outcomes. For revoked and
-- expired keys, used_minute and used_day are never assigned (they stay at 0), so the
-- return value showed almost-full quota remaining for a key that cannot be used.
--
-- Fix: return 0 remaining for any non-allowed outcome, matching the InMemory repo.

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
      and api_request_logs.outcome = 'allowed';

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
    'remaining_minute', case
      when outcome = 'allowed' then greatest(p_minute_limit - (used_minute + 1), 0)
      else 0
    end,
    'remaining_day', case
      when outcome = 'allowed' then greatest(p_day_limit - (used_day + 1), 0)
      else 0
    end,
    'log_id', log_id
  );

  return result;
end;
$$;

revoke all on function public.api_key_authorize(char(64), integer, integer) from public;
revoke all on function public.api_key_authorize(char(64), integer, integer) from anon;
revoke all on function public.api_key_authorize(char(64), integer, integer) from authenticated;
grant execute on function public.api_key_authorize(char(64), integer, integer) to service_role;
