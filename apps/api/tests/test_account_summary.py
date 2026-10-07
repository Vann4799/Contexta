from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app.account.repository import (
    ACTIVITY_WINDOW_DAYS,
    KEY_USAGE_WINDOW_DAYS,
    InMemoryAccountRepository,
)
from app.account.routes import get_account_repository
from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.main import app

client = TestClient(app)

MIGRATION = (
    Path(__file__).resolve().parents[3]
    / "infra"
    / "supabase"
    / "migrations"
    / "0004_account_summary.sql"
)

NOW = datetime(2026, 10, 7, 12, 0, 0, tzinfo=timezone.utc)
OWNER = CurrentUser(id="owner-1", email="owner@example.test", role="authenticated")
OTHER = CurrentUser(id="owner-2", email="other@example.test", role="authenticated")


def use_repository(repository: InMemoryAccountRepository, user: CurrentUser = OWNER) -> None:
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_account_repository] = lambda: repository


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


def seed_workspace(repository: InMemoryAccountRepository, user_id: str) -> None:
    repository.add_document(user_id, "ready", "report", 1000, NOW - timedelta(days=1))
    repository.add_document(user_id, "ready", "report", 2000, NOW - timedelta(days=3))
    repository.add_document(user_id, "failed", "sop", 500, NOW - timedelta(days=30))
    repository.add_document(user_id, "processing", "unclassified", 300, NOW - timedelta(days=2))
    for _ in range(5):
        repository.add_chunk(user_id, NOW - timedelta(days=1))
    for _ in range(3):
        repository.add_chunk(user_id, NOW - timedelta(days=2))
    repository.add_chunk(user_id, NOW - timedelta(days=40))
    repository.add_session(user_id)
    repository.add_message(user_id, "user", NOW - timedelta(days=1))
    repository.add_message(user_id, "assistant", NOW - timedelta(days=1))
    repository.add_message(user_id, "user", NOW - timedelta(days=2))
    repository.add_message(user_id, "user", NOW - timedelta(days=30))
    repository.add_api_key(user_id)
    repository.add_api_key(user_id, revoked_at=NOW - timedelta(days=1))
    repository.add_api_key(user_id, expires_at=NOW - timedelta(hours=1))
    for offset in (0, 2, 3):
        repository.add_log(user_id, NOW - timedelta(days=offset))
    for offset in (20, 21):
        repository.add_log(user_id, NOW - timedelta(days=offset))


def test_summary_matches_the_hand_computed_sql_fixture():
    """These are the same 26 figures the migration was verified with on a real Postgres."""
    repository = InMemoryAccountRepository(clock=lambda: NOW)
    seed_workspace(repository, OWNER.id)
    use_repository(repository)

    response = client.get("/account/summary")
    assert response.status_code == 200

    body = response.json()
    assert body["documents"] == {
        "total": 4,
        "by_status": {"uploaded": 0, "processing": 1, "ready": 2, "failed": 1},
    }
    assert body["chunks"] == 9
    assert body["sessions"] == 1
    assert body["storage_bytes"] == 3800
    assert body["top_doc_type"] == {"doc_type": "report", "documents": 2}
    assert body["activity"]["uploads_7d"] == 3
    assert body["activity"]["indexed_7d"] == 8
    assert body["activity"]["chats_7d"] == 2
    assert body["developer"] == {"api_keys_active": 1, "api_requests_14d": 3}


def test_empty_workspace_is_zero_not_missing():
    use_repository(InMemoryAccountRepository(clock=lambda: NOW))

    body = client.get("/account/summary").json()
    assert body["documents"]["total"] == 0
    assert body["documents"]["by_status"] == {
        "uploaded": 0,
        "processing": 0,
        "ready": 0,
        "failed": 0,
    }
    assert body["chunks"] == 0
    assert body["sessions"] == 0
    assert body["storage_bytes"] == 0
    assert body["top_doc_type"] is None
    assert body["activity"]["last_upload_at"] is None
    assert body["activity"]["last_index_at"] is None
    assert body["activity"]["last_chat_at"] is None


def test_one_owner_cannot_see_another_workspace():
    repository = InMemoryAccountRepository(clock=lambda: NOW)
    seed_workspace(repository, OWNER.id)
    # A second, much busier workspace must not move the first owner's numbers.
    for _ in range(10):
        repository.add_document(OTHER.id, "ready", "contract", 700, NOW)
        repository.add_chunk(OTHER.id, NOW)
        repository.add_message(OTHER.id, "user", NOW)
    repository.add_session(OTHER.id)
    repository.add_session(OTHER.id)
    use_repository(repository, OWNER)

    body = client.get("/account/summary").json()
    assert body["documents"]["total"] == 4
    assert body["chunks"] == 9
    assert body["sessions"] == 1
    assert body["top_doc_type"]["doc_type"] == "report"

    use_repository(repository, OTHER)
    other_body = client.get("/account/summary").json()
    assert other_body["documents"]["total"] == 10
    assert other_body["chunks"] == 10
    assert other_body["sessions"] == 2
    assert other_body["storage_bytes"] == 7000


def test_top_doc_type_tie_breaks_on_the_older_document():
    repository = InMemoryAccountRepository(clock=lambda: NOW)
    repository.add_document(OWNER.id, "ready", "report", 10, NOW - timedelta(days=5))
    repository.add_document(OWNER.id, "ready", "sop", 10, NOW - timedelta(days=90))
    repository.add_document(OWNER.id, "ready", "report", 10, NOW - timedelta(days=4))
    repository.add_document(OWNER.id, "ready", "sop", 10, NOW - timedelta(days=80))
    use_repository(repository)

    assert client.get("/account/summary").json()["top_doc_type"] == {
        "doc_type": "sop",
        "documents": 2,
    }


def test_summary_requires_a_session():
    app.dependency_overrides.clear()
    assert client.get("/account/summary").status_code == 401


def test_unexpected_rpc_shape_is_a_503_not_a_page_of_zeros():
    class BrokenRepository:
        def summary(self, user_id: str) -> dict[str, object]:
            return {"documents": {"total": 1}}

    use_repository(BrokenRepository())  # type: ignore[arg-type]

    response = client.get("/account/summary")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "account_summary_malformed"


def test_postgrest_failure_reports_a_real_code():
    class FailingRepository:
        def summary(self, user_id: str) -> dict[str, object]:
            raise httpx.ConnectError("postgrest down")

    use_repository(FailingRepository())  # type: ignore[arg-type]

    response = client.get("/account/summary")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "account_summary_unavailable"


def test_windows_in_python_match_the_migration():
    """The window lengths live in two languages; drift would change the page silently."""
    sql = MIGRATION.read_text()

    assert f"interval '{ACTIVITY_WINDOW_DAYS} days'" in sql
    assert f"interval '{KEY_USAGE_WINDOW_DAYS} days'" in sql
    assert "count(*) as chunks" in sql
    assert "count(*) as sessions" in sql
