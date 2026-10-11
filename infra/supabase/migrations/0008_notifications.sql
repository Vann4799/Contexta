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
