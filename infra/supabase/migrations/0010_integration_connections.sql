-- Integration connections for OAuth-based third-party services
create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('slack', 'notion', 'google_drive', 'github')),
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error')),
  external_user_id text,
  external_user_name text,
  external_user_email text,
  scopes jsonb not null default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb,
  connected_at timestamptz default now(),
  last_synced_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- Index for fast per-user lookups
create index if not exists idx_integration_connections_user_id
  on public.integration_connections (user_id);
