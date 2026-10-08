from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.apikeys.dependencies import (
    FAILED_LOOKUP_LIMIT,
    _failed_lookups,
    get_api_key_repository,
    seconds_to_next_day,
)
from app.apikeys.repository import InMemoryApiKeyRepository, SupabaseApiKeyRepository
from app.apikeys.secrets import API_KEY_PREFIX, generate_api_key, hash_api_key
from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.chat.routes import get_retriever
from app.core.config import Settings, get_settings
from app.documents.models import DocumentCreate, DocumentResponse
from app.documents.repository import InMemoryDocumentRepository
from app.documents.routes import get_document_repository
from app.main import app


client = TestClient(app)

USER_ID = "user-keys-1"
OTHER_USER_ID = "user-keys-2"
KEY_ID_HEADER = "Authorization"


class FakeRetriever:
    """Stands in for QdrantRetriever and records the filters it was handed."""

    def __init__(self, contexts: list[dict[str, Any]] | None = None) -> None:
        self.calls: list[dict[str, Any]] = []
        # Each fixture context carries the owner it belongs to, the way a Qdrant payload
        # does, so scoping by user is exercised rather than assumed.
        self._contexts = contexts or []

    def retrieve(
        self,
        user_id: str,
        question: str,
        document_ids: list[str] | None = None,
        top_k: int = 5,
        doc_types: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        self.calls.append(
            {
                "user_id": user_id,
                "question": question,
                "document_ids": document_ids,
                "top_k": top_k,
                "doc_types": doc_types,
            }
        )
        if document_ids is not None and not document_ids:
            return []
        return [
            {key: value for key, value in context.items() if key != "owner"}
            for context in self._contexts
            if context["owner"] == user_id
            and (document_ids is None or context["document_id"] in document_ids)
        ]


def context(document_id: str, chunk_index: int = 0, owner: str = USER_ID) -> dict[str, Any]:
    return {
        "owner": owner,
        "document_id": document_id,
        "document_name": f"{document_id}.pdf",
        "doc_type": "report",
        "chunk_index": chunk_index,
        "page_number": 1,
        "section_path": "1. Intro",
        "text": f"body of {document_id} chunk {chunk_index}",
        "score": 0.72,
    }


def settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "environment": "test",
        "api_key_minute_limit": 3,
        "api_key_day_limit": 6,
        **overrides,
    }
    return Settings(**values)


def make_document(repository: InMemoryDocumentRepository, user_id: str, filename: str) -> DocumentResponse:
    return repository.create_document(
        user_id,
        DocumentCreate(
            filename=filename,
            file_type="pdf",
            file_size=2048,
            storage_path=f"{user_id}/{filename}",
            doc_type="report",
        ),
    )


def mark_ready(repository: InMemoryDocumentRepository, document: DocumentResponse) -> None:
    """create_document starts in 'processing'; the export endpoints refuse that."""
    repository.update_document_metadata(
        document.user_id,
        document.id,
        {"status": "ready"},
    )


def make_key(
    repository: InMemoryApiKeyRepository,
    user_id: str,
    *,
    name: str = "ci",
    document_ids: list[str] | None = None,
    expires_at: datetime | None = None,
) -> str:
    plaintext = f"{API_KEY_PREFIX}secret-for-{user_id}-{name}-{len(repository.list_keys(user_id))}"
    repository.create_key(
        user_id=user_id,
        name=name,
        key_hash=hash_api_key(plaintext),
        key_prefix=plaintext[:13],
        last_four=plaintext[-4:],
        document_ids=document_ids or [],
        scopes=["retrieve"],
        expires_at=expires_at,
    )
    return plaintext


def wire(
    keys: InMemoryApiKeyRepository,
    documents: InMemoryDocumentRepository,
    retriever: FakeRetriever,
    current_user_id: str = USER_ID,
    **setting_overrides: Any,
) -> None:
    app.dependency_overrides[get_api_key_repository] = lambda: keys
    app.dependency_overrides[get_document_repository] = lambda: documents
    app.dependency_overrides[get_retriever] = lambda: retriever
    app.dependency_overrides[get_settings] = lambda: settings(**setting_overrides)
    app.dependency_overrides[get_current_user] = (
        lambda: CurrentUser(id=current_user_id, email="u@example.com", role="authenticated")
    )
    _failed_lookups.reset()


def bearer(key: str) -> dict[str, str]:
    return {KEY_ID_HEADER: f"Bearer {key}"}


def teardown_function(_context) -> None:
    app.dependency_overrides.clear()


def test_valid_key_returns_only_that_users_chunks() -> None:
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    mine = make_document(documents, USER_ID, "mine.pdf")
    theirs = make_document(documents, OTHER_USER_ID, "theirs.pdf")
    retriever = FakeRetriever([context(mine.id), context(theirs.id, owner=OTHER_USER_ID)])
    wire(keys, documents, retriever)
    key = make_key(keys, USER_ID)

    response = client.post("/v1/retrieve", json={"query": "what"}, headers=bearer(key))

    assert response.status_code == 200, response.text
    body = response.json()
    assert [item["document_id"] for item in body["data"]] == [mine.id]
    assert body["meta"]["retrieved"] == 1
    # The retriever is scoped by the key's owner, never by anything the caller sent.
    assert retriever.calls[0]["user_id"] == USER_ID
    assert "user_id" not in body["data"][0]


def test_body_cannot_borrow_another_users_document() -> None:
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    mine = make_document(documents, USER_ID, "mine.pdf")
    retriever = FakeRetriever([context(mine.id)])
    wire(keys, documents, retriever)
    key = make_key(keys, USER_ID)

    response = client.post(
        "/v1/retrieve",
        json={"query": "what", "user_id": OTHER_USER_ID},
        headers=bearer(key),
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_request"
    assert retriever.calls == []


def test_missing_and_bogus_keys_get_the_same_generic_401() -> None:
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    retriever = FakeRetriever()
    wire(keys, documents, retriever)

    anonymous = client.post("/v1/retrieve", json={"query": "what"})
    wrong = client.post("/v1/retrieve", json={"query": "what"}, headers=bearer("ctx_live_nope"))

    assert anonymous.status_code == 401
    assert wrong.status_code == 401
    # No leak of whether the key exists, and no hint the JWT path is different.
    assert anonymous.json()["detail"]["code"] == wrong.json()["detail"]["code"]
    assert "not recognized" in wrong.json()["detail"]["message"].lower()


def test_revoked_and_expired_keys_are_403_with_distinct_codes() -> None:
    documents = InMemoryDocumentRepository()
    retriever = FakeRetriever()

    keys = InMemoryApiKeyRepository()
    wire(keys, documents, retriever)
    key = make_key(keys, USER_ID)
    row = keys.list_keys(USER_ID)[0]
    keys.revoke_key(USER_ID, row["id"])
    revoked = client.post("/v1/retrieve", json={"query": "what"}, headers=bearer(key))
    assert revoked.status_code == 403
    assert revoked.json()["detail"]["code"] == "api_key_revoked"

    keys = InMemoryApiKeyRepository()
    wire(keys, documents, retriever)
    key = make_key(keys, USER_ID, expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
    expired = client.post("/v1/retrieve", json={"query": "what"}, headers=bearer(key))
    assert expired.status_code == 403
    assert expired.json()["detail"]["code"] == "api_key_expired"
    assert retriever.calls == []


def test_minute_quota_rejects_with_retry_after() -> None:
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    retriever = FakeRetriever([context("doc-1")])
    wire(keys, documents, retriever, api_key_minute_limit=2, api_key_day_limit=50)
    key = make_key(keys, USER_ID)

    statuses = [
        client.post("/v1/retrieve", json={"query": "what"}, headers=bearer(key)).status_code
        for _ in range(4)
    ]

    assert statuses == [200, 200, 429, 429]
    blocked = client.post("/v1/retrieve", json={"query": "what"}, headers=bearer(key))
    assert blocked.headers["retry-after"].isdigit()
    assert int(blocked.headers["retry-after"]) <= 60
    assert blocked.json()["detail"]["code"] == "quota_minute_exceeded"


def test_day_quota_is_separate_from_the_minute_window() -> None:
    clock_time = {"now": datetime(2026, 10, 7, 9, 0, 0, tzinfo=timezone.utc)}
    keys = InMemoryApiKeyRepository(clock=lambda: clock_time["now"])
    documents = InMemoryDocumentRepository()
    retriever = FakeRetriever([context("doc-1")])
    wire(keys, documents, retriever, api_key_minute_limit=10, api_key_day_limit=3)
    key = make_key(keys, USER_ID)

    assert [
        client.post("/v1/retrieve", json={"query": "what"}, headers=bearer(key)).status_code
        for _ in range(3)
    ] == [200, 200, 200]

    # Past the minute boundary the short window resets, but the day total has not.
    clock_time["now"] += timedelta(minutes=2)
    over = client.post("/v1/retrieve", json={"query": "what"}, headers=bearer(key))
    assert over.status_code == 429
    assert over.json()["detail"]["code"] == "quota_day_exceeded"


def test_seconds_to_next_day_counts_to_the_utc_day_boundary() -> None:
    assert (
        seconds_to_next_day(datetime(2026, 10, 7, 9, 2, tzinfo=timezone.utc))
        == 14 * 3600 + 58 * 60
    )
    assert seconds_to_next_day(datetime(2026, 10, 7, 23, 59, 30, tzinfo=timezone.utc)) == 30
    assert seconds_to_next_day(datetime(2026, 10, 7, 0, 0, tzinfo=timezone.utc)) == 86400


def test_day_quota_retry_after_waits_for_the_day_boundary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A daily allowance exhausted at 09:00 does not clear in 40 seconds."""
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    retriever = FakeRetriever([context("doc-1")])
    wire(keys, documents, retriever, api_key_minute_limit=10, api_key_day_limit=1)
    key = make_key(keys, USER_ID)

    assert (
        client.post("/v1/retrieve", json={"query": "what"}, headers=bearer(key)).status_code
        == 200
    )
    monkeypatch.setattr("app.apikeys.dependencies.seconds_to_next_day", lambda: 43210)

    over = client.post("/v1/retrieve", json={"query": "what"}, headers=bearer(key))

    assert over.status_code == 429
    assert over.json()["detail"]["code"] == "quota_day_exceeded"
    assert over.headers["retry-after"] == "43210"


def test_unknown_body_field_cannot_silently_widen_the_filter() -> None:
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    retriever = FakeRetriever([context("doc-1")])
    wire(keys, documents, retriever)
    key = make_key(keys, USER_ID)

    response = client.post(
        "/v1/retrieve",
        json={"query": "what", "document_id": "doc-1"},
        headers=bearer(key),
    )

    assert response.status_code == 422
    assert retriever.calls == []


def test_doc_types_are_whitelisted_before_they_reach_the_index() -> None:
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    retriever = FakeRetriever([context("doc-1")])
    wire(keys, documents, retriever)
    key = make_key(keys, USER_ID)

    rejected = client.post(
        "/v1/retrieve",
        json={"query": "what", "doc_types": ["passwords"]},
        headers=bearer(key),
    )

    assert rejected.status_code == 422
    assert retriever.calls == []

    accepted = client.post(
        "/v1/retrieve",
        json={"query": "what", "doc_types": ["sop"]},
        headers=bearer(key),
    )
    assert accepted.status_code == 200
    assert retriever.calls[-1]["doc_types"] == ["sop"]


def test_subset_key_cannot_read_documents_outside_its_scope() -> None:
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    inside = make_document(documents, USER_ID, "inside.pdf")
    outside = make_document(documents, USER_ID, "outside.pdf")
    retriever = FakeRetriever([context(inside.id), context(outside.id)])
    wire(keys, documents, retriever)
    key = make_key(keys, USER_ID, document_ids=[inside.id])

    response = client.post("/v1/retrieve", json={"query": "what"}, headers=bearer(key))

    assert response.status_code == 200
    assert [item["document_id"] for item in response.json()["data"]] == [inside.id]
    assert retriever.calls[0]["document_ids"] == [inside.id]
    assert response.json()["meta"]["document_scope"] == "subset"


def test_export_path_404s_for_documents_the_key_may_not_read() -> None:
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    inside = make_document(documents, USER_ID, "inside.pdf")
    outside = make_document(documents, USER_ID, "outside.pdf")
    other = make_document(documents, OTHER_USER_ID, "other.pdf")
    documents.add_chunks(
        [
            {
                "document_id": inside.id,
                "user_id": USER_ID,
                "chunk_index": 0,
                "text": "content the key may read",
                "page_number": 1,
                "section_path": None,
                "qdrant_point_id": f"point-{inside.id}",
            }
        ]
    )
    retriever = FakeRetriever()
    wire(keys, documents, retriever)
    key = make_key(keys, USER_ID, document_ids=[inside.id])
    mark_ready(documents, inside)
    mark_ready(documents, outside)

    allowed = client.get(f"/v1/documents/{inside.id}/export?format=md", headers=bearer(key))
    scoped_out = client.get(f"/v1/documents/{outside.id}/export?format=md", headers=bearer(key))
    foreign = client.get(f"/v1/documents/{other.id}/export?format=md", headers=bearer(key))
    unindexed = client.get(
        f"/v1/documents/{outside.id}/export?format=jsonl",
        headers=bearer(make_key(keys, USER_ID, name="all")),
    )

    assert allowed.status_code == 200
    assert "content the key may read" in allowed.text
    # Existence is not confirmed for either a foreign document or an out-of-scope one.
    assert scoped_out.status_code == 404
    assert foreign.status_code == 404
    assert scoped_out.json()["detail"]["code"] == foreign.json()["detail"]["code"]
    # A document the key may read but that has no chunks is a different, honest answer.
    assert unindexed.status_code == 409
    assert unindexed.json()["detail"]["code"] == "document_not_exportable"


def test_export_refuses_a_document_whose_indexing_is_not_finished() -> None:
    """A re-index sets the status back to processing and keeps the old chunk rows readable."""
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    document = make_document(documents, USER_ID, "thesis.pdf")
    mark_ready(documents, document)
    documents.add_chunks(
        [
            {
                "document_id": document.id,
                "user_id": USER_ID,
                "chunk_index": 0,
                "text": "bab satu",
                "page_number": 1,
                "section_path": None,
                "qdrant_point_id": f"point-{document.id}",
            }
        ]
    )
    wire(keys, documents, FakeRetriever())
    key = make_key(keys, USER_ID)

    ready = client.get(f"/v1/documents/{document.id}/export?format=md", headers=bearer(key))
    documents.reindex_ready_document(USER_ID, document.id)
    mid_reindex = client.get(
        f"/v1/documents/{document.id}/export?format=jsonl", headers=bearer(key)
    )

    assert ready.status_code == 200
    assert mid_reindex.status_code == 409
    assert mid_reindex.json()["detail"]["code"] == "document_not_exportable"
    assert mid_reindex.json()["detail"]["message"] == "document indexing is not finished yet"


def test_documents_listing_follows_the_key_subset() -> None:
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    inside = make_document(documents, USER_ID, "inside.pdf")
    make_document(documents, USER_ID, "outside.pdf")
    make_document(documents, OTHER_USER_ID, "nope.pdf")
    # The worker writes indexed_at in Postgres, so a live row always carries a datetime.
    # Left as None here, /v1/documents answered 200 in the suite and 500 in production.
    documents._documents[0] = inside.model_copy(
        update={"indexed_at": datetime(2026, 10, 7, 3, 4, 5, tzinfo=timezone.utc)}
    )
    retriever = FakeRetriever()
    wire(keys, documents, retriever)
    key = make_key(keys, USER_ID, document_ids=[inside.id])

    response = client.get("/v1/documents", headers=bearer(key))

    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body["data"]] == [inside.id]
    assert body["meta"]["total"] == 1
    assert "storage_path" not in body["data"][0]
    assert body["data"][0]["indexed_at"] == "2026-10-07T03:04:05+00:00"


def test_keys_me_reports_the_live_quota() -> None:
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    retriever = FakeRetriever([context("doc-1")])
    wire(keys, documents, retriever, api_key_minute_limit=5, api_key_day_limit=50)
    key = make_key(keys, USER_ID, name="named-key")

    response = client.get("/v1/keys/me", headers=bearer(key))

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["name"] == "named-key"
    assert data["limits"] == {"per_minute": 5, "per_day": 50}
    # The request that asked is itself counted, so one slot of the minute window is gone.
    assert data["remaining"] == {"minute": 4, "day": 49}
    assert "api_key" not in str(response.json())


def test_quota_headers_are_on_every_allowed_response() -> None:
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    retriever = FakeRetriever([context("doc-1")])
    wire(keys, documents, retriever, api_key_minute_limit=7, api_key_day_limit=70)
    key = make_key(keys, USER_ID)

    response = client.post("/v1/retrieve", json={"query": "what"}, headers=bearer(key))

    assert response.headers["x-ratelimit-limit-minute"] == "7"
    assert response.headers["x-ratelimit-remaining-minute"] == "6"
    assert response.headers["x-ratelimit-remaining-day"] == "69"


def test_a_browser_can_read_the_quota_headers_cross_origin() -> None:
    """Sending them is not enough: an unexposed response header is invisible to JS."""
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    retriever = FakeRetriever([context("doc-1")])
    wire(keys, documents, retriever, api_key_minute_limit=7, api_key_day_limit=70)
    key = make_key(keys, USER_ID)

    response = client.post(
        "/v1/retrieve",
        json={"query": "what"},
        headers={**bearer(key), "Origin": "http://localhost:3000"},
    )

    assert response.status_code == 200, response.text
    exposed = response.headers.get("access-control-expose-headers", "").lower()
    for name in (
        "x-ratelimit-limit-minute",
        "x-ratelimit-remaining-minute",
        "x-ratelimit-limit-day",
        "x-ratelimit-remaining-day",
        "retry-after",
    ):
        assert name in exposed, name


def test_the_audit_row_records_the_status_the_client_got() -> None:
    """authorize() writes the row before the route body runs.

    Without a write-back every admitted request logs 200, so an integrator that keeps
    404ing looks like a healthy customer in their own usage panel.
    """
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    mine = make_document(documents, USER_ID, "mine.pdf")
    retriever = FakeRetriever([context(mine.id)])
    wire(keys, documents, retriever)
    key = make_key(keys, USER_ID)

    missing = client.get("/v1/documents/does-not-exist/export", headers=bearer(key))
    served = client.post("/v1/retrieve", json={"query": "what"}, headers=bearer(key))

    assert missing.status_code == 404, missing.text
    assert served.status_code == 200, served.text
    first, second = keys._logs[-2:]
    assert first["outcome"] == "allowed"
    assert first["status_code"] == 404
    assert first["document_ids_hit"] == []
    assert second["status_code"] == 200
    assert second["document_ids_hit"] == [mine.id]
    assert second["latency_ms"] is not None


def test_audit_log_records_outcomes_without_storing_content() -> None:
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    retriever = FakeRetriever([context("doc-1")])
    wire(keys, documents, retriever, api_key_minute_limit=1, api_key_day_limit=5)
    key = make_key(keys, USER_ID)

    client.post("/v1/retrieve", json={"query": "salary secrets"}, headers=bearer(key))
    client.post("/v1/retrieve", json={"query": "second"}, headers=bearer(key))
    client.post("/v1/retrieve", json={"query": "third"}, headers=bearer("ctx_live_bad"))

    outcomes = [log["outcome"] for log in keys._logs]
    assert outcomes == ["allowed", "quota_minute", "invalid"]
    assert keys._logs[0]["status_code"] == 200
    assert keys._logs[0]["document_ids_hit"] == ["doc-1"]
    assert keys._logs[0]["latency_ms"] is not None
    # The audit trail counts requests; it never copies the question or the chunk text.
    assert "salary secrets" not in str(keys._logs)
    assert all(log["user_id"] == USER_ID for log in keys._logs[:2])
    assert keys._logs[2]["user_id"] is None


def test_owner_can_create_list_and_revoke_a_key() -> None:
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    document = make_document(documents, USER_ID, "mine.pdf")
    retriever = FakeRetriever()
    wire(keys, documents, retriever)

    created = client.post(
        "/api-keys",
        json={"name": "notebook", "document_ids": [document.id]},
    )

    assert created.status_code == 201, created.text
    assert created.headers["location"] == f"/api-keys/{created.json()['id']}"
    plaintext = created.json()["api_key"]
    assert plaintext.startswith(API_KEY_PREFIX)
    assert created.json()["key_prefix"] == plaintext[:13]
    assert created.json()["last_four"] == plaintext[-4:]

    listed = client.get("/api-keys")
    assert listed.status_code == 200
    assert [item["name"] for item in listed.json()] == ["notebook"]
    # The list view has no secret field at all.
    assert "api_key" not in listed.text
    assert "key_hash" not in listed.text

    revoked = client.post(f"/api-keys/{listed.json()[0]['id']}/revoke")
    assert revoked.status_code == 200
    assert revoked.json()["revoked_at"] is not None

    # Revoking twice is not a failure: the key is revoked either way, and the confirm
    # dialog's button can be clicked again before the row disappears from the list.
    assert client.post(f"/api-keys/{listed.json()[0]['id']}/revoke").status_code == 200

    assert client.post("/api-keys/missing/revoke").status_code == 404


def test_create_rejects_document_ids_the_user_does_not_own() -> None:
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    theirs = make_document(documents, OTHER_USER_ID, "theirs.pdf")
    retriever = FakeRetriever()
    wire(keys, documents, retriever)

    response = client.post("/api-keys", json={"name": "x", "document_ids": [theirs.id]})

    assert response.status_code == 422
    assert keys.list_keys(USER_ID) == []


def test_usage_reports_counts_per_day_and_outcome() -> None:
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    retriever = FakeRetriever([context("doc-1")])
    wire(keys, documents, retriever, api_key_minute_limit=2, api_key_day_limit=50)
    key = make_key(keys, USER_ID)
    key_id = keys.list_keys(USER_ID)[0]["id"]
    for _ in range(3):
        client.post("/v1/retrieve", json={"query": "what"}, headers=bearer(key))

    response = client.get(f"/api-keys/{key_id}/usage?days=14")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert body["allowed"] == 2
    assert body["rejected"] == 1
    assert body["by_outcome"]["quota_minute"] == 1
    assert len(body["by_day"]) == 14
    assert body["by_day"][-1] == {"date": body["by_day"][-1]["date"], "allowed": 2, "rejected": 1}
    assert client.get(f"/api-keys/{key_id}/usage?days=999").status_code == 422


def test_usage_window_bounds_the_totals_not_only_the_day_columns() -> None:
    """The live RPC reported total=2 next to by_outcome showing 64 requests because the
    window filtered by_day only. One window, applied to every figure."""
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    retriever = FakeRetriever([context("doc-1")])
    wire(keys, documents, retriever)
    key = make_key(keys, USER_ID)
    key_id = keys.list_keys(USER_ID)[0]["id"]
    client.post("/v1/retrieve", json={"query": "today"}, headers=bearer(key))
    keys._logs.append(
        {
            "id": 999,
            "key_id": key_id,
            "user_id": USER_ID,
            "outcome": "allowed",
            "status_code": 200,
            "created_at": datetime.now(timezone.utc) - timedelta(days=40),
        }
    )

    body = client.get(f"/api-keys/{key_id}/usage?days=14").json()

    assert body["total"] == 1
    assert body["allowed"] == 1
    assert body["by_outcome"] == {"allowed": 1}
    assert sum(day["allowed"] + day["rejected"] for day in body["by_day"]) == body["total"]


def test_v1_is_not_open_to_browser_origins() -> None:
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    retriever = FakeRetriever([context("doc-1")])
    wire(keys, documents, retriever)
    key = make_key(keys, USER_ID)

    response = client.post(
        "/v1/retrieve",
        json={"query": "what"},
        headers={**bearer(key), "Origin": "https://evil.example"},
    )

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_failed_lookup_budget_absorbs_a_retry_storm_without_locking_out_others() -> None:
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    retriever = FakeRetriever()
    wire(keys, documents, retriever)
    good = make_key(keys, USER_ID)

    def attempt(secret: str) -> int:
        return client.post(
            "/v1/retrieve", json={"query": "what"}, headers=bearer(secret)
        ).status_code

    for _ in range(FAILED_LOOKUP_LIMIT):
        assert attempt(f"{API_KEY_PREFIX}guess") == 401
    assert attempt(f"{API_KEY_PREFIX}guess") == 429

    # The address is Caddy's, not the caller's, so a per-address bucket here would have
    # turned one storm into an outage for every other tenant.
    distinct = {attempt(f"{API_KEY_PREFIX}guess{index}") for index in range(35)}
    assert distinct == {401}
    assert attempt(good) == 200
    # Every rejected attempt stopped at authorization; none of them read the corpus.
    assert len(retriever.calls) == 1


def test_key_created_through_the_api_authorizes_the_next_request() -> None:
    """The create path and the authorize path must agree on how the secret is stored."""
    keys = InMemoryApiKeyRepository()
    documents = InMemoryDocumentRepository()
    retriever = FakeRetriever([context("doc-1")])
    wire(keys, documents, retriever)
    created = client.post("/api-keys", json={"name": "roundtrip"})
    plaintext = created.json()["api_key"]

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=USER_ID, email="u@example.com", role="authenticated"
    )
    response = client.post("/v1/retrieve", json={"query": "what"}, headers=bearer(plaintext))

    assert response.status_code == 200, response.text
    assert keys.list_keys(USER_ID)[0]["last_used_at"] is not None


def test_generated_key_is_the_promised_shape() -> None:
    """token_urlsafe counts bytes, not characters: 26 of them encode to 35 characters.

    The published shape is ctx_live_ + 26 characters, so the generator slices.
    """
    plaintext, key_hash, key_prefix, last_four = generate_api_key()

    assert len(plaintext) == len(API_KEY_PREFIX) + 26
    assert key_prefix == plaintext[: len(API_KEY_PREFIX) + 4]
    assert last_four == plaintext[-4:]
    assert key_hash == hash_api_key(plaintext)


class _BrokenApiKeyStore(InMemoryApiKeyRepository):
    """Stands in for a PostgREST table that is missing or refusing requests."""

    def list_keys(self, user_id: str) -> list[dict[str, object]]:
        raise RuntimeError('relation "api_keys" does not exist')


def test_store_failures_reach_the_caller_instead_of_looking_like_cors() -> None:
    """An exception that escapes a route is answered by Starlette's ServerErrorMiddleware,
    which sits outside CORSMiddleware, so the browser reports a CORS block and the real
    cause never arrives. This cost me a wrong diagnosis on the live host."""
    documents = InMemoryDocumentRepository()
    wire(_BrokenApiKeyStore(), documents, FakeRetriever())

    listed = client.get("/api-keys")
    created = client.post("/api-keys", json={"name": "notebook"})

    for response in (listed, created):
        assert response.status_code == 503, response.text
        assert response.json()["detail"]["code"] == "api_key_store_unavailable"
    assert "relation" not in listed.text


def test_postgrest_message_reaches_the_log_not_just_the_status_code(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The live authorize failure was a 42702 inside a 503 with no cause anywhere the
    operator could read, so PostgREST's own body has to land in the log."""
    documents = InMemoryDocumentRepository()
    wire(_AmbiguousColumnStore(), documents, FakeRetriever())

    with caplog.at_level(logging.ERROR):
        assert client.get("/api-keys").status_code == 503

    assert "ambiguous" in caplog.text


class _AmbiguousColumnStore(InMemoryApiKeyRepository):
    def list_keys(self, user_id: str) -> list[dict[str, object]]:
        request = httpx.Request("GET", "https://example/rest/v1/api_keys")
        response = httpx.Response(
            400, request=request, content=b'{"code":"42702","message":"column reference \\"outcome\\" is ambiguous"}'
        )
        raise httpx.HTTPStatusError("400", request=request, response=response)


KEY_ID = "0b1c2d3e-4f50-4a1b-9c8d-7e6f5a4b3c2d"


class _PostgRESTKeys:
    """Stands in for httpx against api_keys, answering PATCH and GET.

    A guarded PATCH that matches nothing comes back as 200 with an empty array, and that
    is the same body for "already revoked" and for "not your key" -- so the fake has to
    leave both cases to the follow-up GET or the fallback that separates them goes
    untested.
    """

    def __init__(self, get_rows: list[dict[str, object]]) -> None:
        self.get_rows = get_rows
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def _response(self, method: str, payload: list[dict[str, object]]) -> httpx.Response:
        return httpx.Response(
            status_code=200,
            request=httpx.Request(method, "https://supabase.test/rest/v1/api_keys"),
            json=payload,
        )

    def patch(self, url: str, **kwargs: Any) -> httpx.Response:
        self.calls.append(("PATCH", kwargs.get("params") or {}))
        return self._response("PATCH", [])

    def get(self, url: str, **kwargs: Any) -> httpx.Response:
        self.calls.append(("GET", kwargs.get("params") or {}))
        return self._response("GET", self.get_rows)


def revoked_key_row() -> dict[str, object]:
    return {
        "id": KEY_ID,
        "user_id": USER_ID,
        "name": "notebook",
        "key_prefix": "ctx_live_abcd",
        "last_four": "9xkQ",
        "document_ids": [],
        "scopes": ["read"],
        "minute_limit": 60,
        "day_limit": 1000,
        "created_at": "2026-10-08T00:00:00+00:00",
        "expires_at": None,
        "last_used_at": None,
        "revoked_at": "2026-10-08T01:00:00+00:00",
    }


@pytest.mark.parametrize(
    "get_rows,revokable",
    [([revoked_key_row()], True), ([], False)],
    ids=["already revoked", "no such key"],
)
def test_an_empty_revoke_patch_is_answered_by_reading_the_row_back(
    monkeypatch: pytest.MonkeyPatch,
    get_rows: list[dict[str, object]],
    revokable: bool,
) -> None:
    """The InMemory double reports 200 for a second revoke; the real store must agree.

    Without the read-back, POST /api-keys/{id}/revoke 404s in production on a click the
    test suite already called a success.
    """
    rest = _PostgRESTKeys(get_rows=get_rows)
    monkeypatch.setattr("app.apikeys.repository.httpx", rest)
    repository = SupabaseApiKeyRepository("https://supabase.test", "service-role")

    row = repository.revoke_key(USER_ID, KEY_ID)

    assert (row is not None) is revokable
    if row is not None:
        assert row["id"] == KEY_ID
        assert row["revoked_at"] is not None
    patch_params = next(params for method, params in rest.calls if method == "PATCH")
    assert patch_params["revoked_at"] == "is.null"
    get_params = next(params for method, params in rest.calls if method == "GET")
    assert get_params == {"id": f"eq.{KEY_ID}", "user_id": f"eq.{USER_ID}", "limit": "1"}
