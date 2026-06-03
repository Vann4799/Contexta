import re
from pathlib import Path


MIGRATION = Path("infra/supabase/migrations/0001_initial_schema.sql")


def _normalized_sql() -> str:
    return " ".join(MIGRATION.read_text(encoding="utf-8").lower().split())


def _normalized_policy(policy_name: str) -> str:
    sql = _normalized_sql()
    match = re.search(
        rf'create policy "{policy_name}".*?(?= drop policy| insert into storage\.buckets)',
        sql,
    )
    assert match is not None
    return match.group(0)


def test_initial_migration_defines_core_tables():
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    for table in [
        "public.profiles",
        "public.documents",
        "public.document_chunks",
        "public.chat_sessions",
        "public.chat_session_documents",
        "public.chat_messages",
    ]:
        assert f"create table if not exists {table}" in sql


def test_initial_migration_enables_rls_and_owner_policies():
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    for table in [
        "profiles",
        "documents",
        "document_chunks",
        "chat_sessions",
        "chat_session_documents",
        "chat_messages",
    ]:
        assert f"alter table public.{table} enable row level security" in sql

    assert "auth.uid() = user_id" in sql
    assert "auth.uid() = id" in sql


def test_initial_migration_adds_document_indexes_and_bucket():
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "idx_documents_user_status" in sql
    assert "idx_document_chunks_document_id" in sql
    assert "idx_chat_messages_session_id" in sql
    assert "contexta-documents" in sql


def test_initial_migration_checks_parent_ownership_on_child_inserts():
    document_chunks_policy = _normalized_policy("document_chunks_insert_own")
    chat_session_documents_policy = _normalized_policy(
        "chat_session_documents_insert_own"
    )
    chat_messages_policy = _normalized_policy("chat_messages_insert_own")

    assert (
        "exists (select 1 from public.documents d "
        "where d.id = document_id and d.user_id = auth.uid())"
    ) in document_chunks_policy
    assert (
        "exists (select 1 from public.chat_sessions s "
        "where s.id = session_id and s.user_id = auth.uid())"
    ) in chat_session_documents_policy
    assert (
        "exists (select 1 from public.chat_sessions s "
        "where s.id = session_id and s.user_id = auth.uid())"
    ) in chat_messages_policy
    assert (
        "exists (select 1 from public.documents d "
        "where d.id = document_id and d.user_id = auth.uid())"
    ) in chat_session_documents_policy


def test_initial_migration_enforces_database_ownership_constraints():
    sql = _normalized_sql()

    assert (
        "constraint documents_storage_path_owner_folder "
        "check (storage_path like user_id::text || '/%')"
    ) in sql
    assert "unique (id, user_id)" in sql
    assert (
        "foreign key (document_id, user_id) "
        "references public.documents(id, user_id) on delete cascade"
    ) in sql
    assert (
        "foreign key (session_id, user_id) "
        "references public.chat_sessions(id, user_id) on delete cascade"
    ) in sql
