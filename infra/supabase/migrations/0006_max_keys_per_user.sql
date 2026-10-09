-- 0006_max_keys_per_user.sql
-- The Python route enforces MAX_KEYS_PER_USER = 10, but a direct PostgREST insert
-- (or a race between two concurrent requests) bypasses that check. A BEFORE INSERT
-- trigger makes the limit durable at the database level.

create or replace function public._enforce_max_keys_per_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_count integer;
begin
  select count(*) into current_count
  from public.api_keys
  where user_id = new.user_id and revoked_at is null;

  if current_count >= 10 then
    raise exception 'maximum of 10 active API keys per user'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_max_keys_per_user on public.api_keys;
create trigger trg_enforce_max_keys_per_user
  before insert on public.api_keys
  for each row
  execute function public._enforce_max_keys_per_user();
