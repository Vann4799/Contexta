-- Allow "trashed" as a valid document status for the soft-delete trash system.
alter table public.documents drop constraint if exists documents_status_check;
alter table public.documents add constraint documents_status_check
  check (status in ('uploaded', 'processing', 'ready', 'failed', 'trashed'));
