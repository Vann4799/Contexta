-- 0012_billing_usage.sql
-- Wave 5 Phase 4: /billing/status answered in 760 ms because get_usage() asked PostgREST for
-- five separate lists and counted them in Python - one round trip per table, and it downloaded
-- every document row just to add up file_size. PostgREST has no GROUP BY, so this RPC answers
-- all five numbers in one call.
--
-- SECURITY INVOKER, like account_summary: the API calls it with the service role, which already
-- bypasses RLS, so what keeps one owner's totals away from another is the p_user_id predicate,
-- not a security clause. The route passes the id resolved from the caller's JWT.
--
-- Semantics are copied from the Python it replaces, quirks included: documents_count counts every
-- row in documents (trashed ones too) and api_keys_count counts revoked keys, because that is what
-- the endpoint returned before. Widening or narrowing a plan limit is a product decision, not a
-- performance fix.

create or replace function public.billing_usage(p_user_id uuid)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with doc_stats as (
    select
      count(*) as documents_count,
      coalesce(sum(file_size), 0) as storage_bytes
    from public.documents
    where user_id = p_user_id
  ),
  key_stats as (
    select count(*) as api_keys_count
    from public.api_keys
    where user_id = p_user_id
  ),
  -- 'today' is UTC midnight, matching the datetime.now(timezone.utc).date() the route used.
  log_stats as (
    select count(*) as api_requests_today
    from public.api_request_logs
    where user_id = p_user_id
      and created_at >= (date_trunc('day', now() at time zone 'utc'))::timestamptz
  ),
  chat_stats as (
    select count(*) as chat_messages_today
    from public.chat_messages
    where user_id = p_user_id
      and role = 'user'
      and created_at >= (date_trunc('day', now() at time zone 'utc'))::timestamptz
  )
  select jsonb_build_object(
    'documents_count', doc_stats.documents_count,
    'storage_bytes', doc_stats.storage_bytes,
    'api_keys_count', key_stats.api_keys_count,
    'api_requests_today', log_stats.api_requests_today,
    'chat_messages_today', chat_stats.chat_messages_today
  )
  from doc_stats, key_stats, log_stats, chat_stats;
$$;

revoke execute on function public.billing_usage(uuid) from public, anon, authenticated;
