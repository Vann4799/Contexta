-- Notifications table for user-facing alerts (document processing complete, failures, etc.)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('document_ready', 'document_failed', 'quota_warning', 'system')),
  title text not null,
  message text,
  metadata jsonb default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_read_idx on public.notifications(user_id, read desc, created_at desc);
create index if not exists notifications_user_id_created_idx on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

-- Defense in depth only. The API talks to PostgREST with the service-role key, which
-- bypasses RLS entirely; these policies exist so that a browser-supplied access token
-- can never read or write another user's notifications.
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Mark all notifications as read for a user
create or replace function public.mark_all_notifications_read(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set read = true
  where user_id = p_user_id and read = false;
$$;

-- SECURITY DEFINER with a caller-supplied user id, so only the service role may run it;
-- the default PUBLIC execute grant would let any signed-in user mark someone else's
-- notifications read straight through RLS.
revoke execute on function public.mark_all_notifications_read(uuid) from public, anon, authenticated;
grant execute on function public.mark_all_notifications_read(uuid) to service_role;
