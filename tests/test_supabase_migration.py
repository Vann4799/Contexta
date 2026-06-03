from pathlib import Path


MIGRATION = Path("infra/supabase/migrations/0001_initial_schema.sql")


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
