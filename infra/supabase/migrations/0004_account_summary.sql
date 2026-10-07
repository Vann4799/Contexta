-- 0004_account_summary.sql
-- T9: the profile page needs ~15 numbers. PostgREST has no GROUP BY, so without one RPC the
-- only ways to get them are downloading every document row and every chat message to the browser
-- and adding them up there (what profile-panel.tsx did), or a dozen count-per-value round trips
-- that still cannot produce a sum or a mode. This function answers the whole page in one call.
--
-- SECURITY INVOKER, like api_key_usage: the API calls it with the service role, which already
-- bypasses RLS, so what keeps one owner's totals away from another is the p_user_id predicate -
-- not a security clause. The route passes the id resolved from the caller's JWT and there is no
-- request field that can override it.
--
-- 'chunks' counts document_chunks rows instead of summing documents.chunk_count. chunk_count is
-- a denormalised convenience column that a retry zeroes and a partial write can leave short, so
-- the row count is the figure that agrees with the vectors actually sitting in Qdrant.

create or replace function public.account_summary(p_user_id uuid)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  -- Each aggregate CTE has no GROUP BY, so it yields exactly one row even for an owner with
  -- nothing in the workspace: counts are 0 and the max() stamps are null. That is what lets the
  -- profile render "0 documents" instead of an error on a fresh account.
  with doc_stats as (
    select
      count(*) as total,
      count(*) filter (where status = 'uploaded') as uploaded,
      count(*) filter (where status = 'processing') as processing,
      count(*) filter (where status = 'ready') as ready,
      count(*) filter (where status = 'failed') as failed,
      coalesce(sum(file_size), 0) as storage_bytes,
      count(*) filter (where created_at >= now() - interval '7 days') as uploads_7d,
      max(created_at) as last_upload_at
    from public.documents
    where user_id = p_user_id
  ),
  chunk_stats as (
    select
      count(*) as chunks,
      count(*) filter (where created_at >= now() - interval '7 days') as indexed_7d,
      max(created_at) as last_index_at
    from public.document_chunks
    where user_id = p_user_id
  ),
  chat_stats as (
    select
      count(*) filter (where role = 'user' and created_at >= now() - interval '7 days') as chats_7d,
      max(created_at) as last_chat_at
    from public.chat_messages
    where user_id = p_user_id
  ),
  -- 'sessions' is saved conversations, 'chats_7d' is questions asked; the profile shows both.
  session_stats as (
    select count(*) as sessions
    from public.chat_sessions
    where user_id = p_user_id
  ),
  key_stats as (
    select count(*) as api_keys_active
    from public.api_keys
    where user_id = p_user_id
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  ),
  log_stats as (
    select count(*) as api_requests_14d
    from public.api_request_logs
    where user_id = p_user_id
      and created_at >= now() - interval '14 days'
  ),
  top_type as (
    select doc_type, count(*) as total
    from public.documents
    where user_id = p_user_id
    group by doc_type
    -- Ties break on the oldest document of that type, so the chip does not shuffle between
    -- page loads. Returns no rows for an empty workspace, which becomes a null field below.
    order by count(*) desc, min(created_at) asc
    limit 1
  )
  select jsonb_build_object(
    'documents', jsonb_build_object(
      'total', doc_stats.total,
      -- Every status is named here even when nothing has that status. Aggregating with
      -- jsonb_object_agg over a GROUP BY would drop the empty statuses entirely, and the UI
      -- reads by_status.ready.
      'by_status', jsonb_build_object(
        'uploaded', doc_stats.uploaded,
        'processing', doc_stats.processing,
        'ready', doc_stats.ready,
        'failed', doc_stats.failed
      )
    ),
    'chunks', chunk_stats.chunks,
    'storage_bytes', doc_stats.storage_bytes,
    'top_doc_type', (
      select jsonb_build_object('doc_type', top_type.doc_type, 'documents', top_type.total)
      from top_type
    ),
    'sessions', session_stats.sessions,
    'activity', jsonb_build_object(
      'uploads_7d', doc_stats.uploads_7d,
      'indexed_7d', chunk_stats.indexed_7d,
      'chats_7d', chat_stats.chats_7d,
      'last_upload_at', doc_stats.last_upload_at,
      'last_index_at', chunk_stats.last_index_at,
      'last_chat_at', chat_stats.last_chat_at
    ),
    'developer', jsonb_build_object(
      'api_keys_active', key_stats.api_keys_active,
      'api_requests_14d', log_stats.api_requests_14d
    )
  )
  from doc_stats, chunk_stats, chat_stats, session_stats, key_stats, log_stats;
$$;

-- chat_messages is indexed on (session_id, created_at) but has no user_id index, so counting one
-- owner's messages would sequential-scan every user's transcript. The activity block needs this.
create index if not exists idx_chat_messages_user_created
  on public.chat_messages (user_id, created_at);

revoke all on function public.account_summary(uuid) from public;
revoke all on function public.account_summary(uuid) from anon;
revoke all on function public.account_summary(uuid) from authenticated;
grant execute on function public.account_summary(uuid) to service_role;
