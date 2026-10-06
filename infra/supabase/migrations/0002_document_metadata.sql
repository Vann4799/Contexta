-- 0002_document_metadata.sql
-- Retrieval filtering and readable citations run on metadata, not on vectors.

alter table public.documents
  add column if not exists doc_type text not null default 'unclassified'
    check (doc_type in (
      'unclassified', 'sop', 'policy', 'contract', 'report', 'thesis', 'reference', 'other'
    ));

alter table public.documents add column if not exists source_url text;
alter table public.documents add column if not exists doc_version text;
alter table public.documents add column if not exists indexed_at timestamptz;
alter table public.documents add column if not exists embedding_model text;
alter table public.documents add column if not exists embedding_dimensions integer;
alter table public.documents add column if not exists chunker_version text;

create index if not exists idx_documents_user_type
  on public.documents (user_id, doc_type);

alter table public.document_chunks add column if not exists section_path text;
alter table public.document_chunks add column if not exists char_count integer
  check (char_count is null or char_count > 0);
-- Deliberately an estimate: ceil(chars / 4). There is no tokenizer in the worker,
-- so this is for context budgeting, never for billing.
alter table public.document_chunks add column if not exists token_count integer
  check (token_count is null or token_count > 0);
alter table public.document_chunks add column if not exists is_table boolean not null default false;
