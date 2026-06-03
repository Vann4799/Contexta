create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  file_type text not null check (file_type in ('pdf', 'docx')),
  file_size bigint not null check (file_size >= 0),
  storage_path text not null,
  status text not null default 'processing' check (status in ('uploaded', 'processing', 'ready', 'failed')),
  processing_started_at timestamptz,
  error_message text,
  chunk_count integer not null default 0 check (chunk_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  text text not null,
  page_number integer check (page_number is null or page_number > 0),
  qdrant_point_id text not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index),
  unique (qdrant_point_id)
);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_session_documents (
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, document_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_documents_user_status on public.documents (user_id, status, created_at desc);
create index if not exists idx_document_chunks_document_id on public.document_chunks (document_id, chunk_index);
create index if not exists idx_document_chunks_user_id on public.document_chunks (user_id);
create index if not exists idx_chat_sessions_user_updated on public.chat_sessions (user_id, updated_at desc);
create index if not exists idx_chat_messages_session_id on public.chat_messages (session_id, created_at);
create index if not exists idx_chat_session_documents_user_id on public.chat_session_documents (user_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists set_chat_sessions_updated_at on public.chat_sessions;
create trigger set_chat_sessions_updated_at
before update on public.chat_sessions
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_session_documents enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own" on public.documents for select using (auth.uid() = user_id);
drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own" on public.documents for insert with check (auth.uid() = user_id);
drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own" on public.documents for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own" on public.documents for delete using (auth.uid() = user_id);

drop policy if exists "document_chunks_select_own" on public.document_chunks;
create policy "document_chunks_select_own" on public.document_chunks for select using (auth.uid() = user_id);
drop policy if exists "document_chunks_insert_own" on public.document_chunks;
create policy "document_chunks_insert_own" on public.document_chunks for insert with check (
  auth.uid() = user_id
  and exists (select 1
    from public.documents d
    where d.id = document_id
      and d.user_id = auth.uid())
);
drop policy if exists "document_chunks_delete_own" on public.document_chunks;
create policy "document_chunks_delete_own" on public.document_chunks for delete using (auth.uid() = user_id);

drop policy if exists "chat_sessions_select_own" on public.chat_sessions;
create policy "chat_sessions_select_own" on public.chat_sessions for select using (auth.uid() = user_id);
drop policy if exists "chat_sessions_insert_own" on public.chat_sessions;
create policy "chat_sessions_insert_own" on public.chat_sessions for insert with check (auth.uid() = user_id);
drop policy if exists "chat_sessions_update_own" on public.chat_sessions;
create policy "chat_sessions_update_own" on public.chat_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "chat_sessions_delete_own" on public.chat_sessions;
create policy "chat_sessions_delete_own" on public.chat_sessions for delete using (auth.uid() = user_id);

drop policy if exists "chat_session_documents_select_own" on public.chat_session_documents;
create policy "chat_session_documents_select_own" on public.chat_session_documents for select using (auth.uid() = user_id);
drop policy if exists "chat_session_documents_insert_own" on public.chat_session_documents;
create policy "chat_session_documents_insert_own" on public.chat_session_documents for insert with check (
  auth.uid() = user_id
  and exists (select 1
    from public.chat_sessions s
    where s.id = session_id
      and s.user_id = auth.uid())
  and exists (select 1
    from public.documents d
    where d.id = document_id
      and d.user_id = auth.uid())
);
drop policy if exists "chat_session_documents_delete_own" on public.chat_session_documents;
create policy "chat_session_documents_delete_own" on public.chat_session_documents for delete using (auth.uid() = user_id);

drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own" on public.chat_messages for select using (auth.uid() = user_id);
drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own" on public.chat_messages for insert with check (
  auth.uid() = user_id
  and exists (select 1
    from public.chat_sessions s
    where s.id = session_id
      and s.user_id = auth.uid())
);

insert into storage.buckets (id, name, public)
values ('contexta-documents', 'contexta-documents', false)
on conflict (id) do nothing;

drop policy if exists "storage_contexta_documents_select_own" on storage.objects;
create policy "storage_contexta_documents_select_own" on storage.objects
for select using (
  bucket_id = 'contexta-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "storage_contexta_documents_insert_own" on storage.objects;
create policy "storage_contexta_documents_insert_own" on storage.objects
for insert with check (
  bucket_id = 'contexta-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "storage_contexta_documents_delete_own" on storage.objects;
create policy "storage_contexta_documents_delete_own" on storage.objects
for delete using (
  bucket_id = 'contexta-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);
