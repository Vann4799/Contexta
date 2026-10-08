from __future__ import annotations

from datetime import datetime, timezone
import json

import httpx
import pytest

from worker.processor import UserVisibleError
from worker.supabase import SupabaseDocumentRepository, SupabaseDocumentStorage


def test_claim_next_processing_document_marks_it_started() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.method == "GET":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": "doc-1",
                        "user_id": "user-1",
                        "filename": "file.pdf",
                        "file_type": "pdf",
                        "storage_path": "user-1/file.pdf",
                        "status": "processing",
                    }
                ],
            )
        if request.method == "PATCH":
            payload = json.loads(request.content)
            assert payload["status"] == "processing"
            assert "processing_started_at" in payload
            return httpx.Response(
                200,
                json=[
                    {
                        "id": "doc-1",
                        "user_id": "user-1",
                        "filename": "file.pdf",
                        "file_type": "pdf",
                        "storage_path": "user-1/file.pdf",
                        "status": "processing",
                    }
                ],
            )
        raise AssertionError(f"Unexpected request {request.method}")

    repository = SupabaseDocumentRepository(
        supabase_url="https://example.supabase.co",
        service_role_key="service-key",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    document = repository.claim_next_processing_document()

    assert document is not None
    assert document["id"] == "doc-1"
    assert requests[0].url.path == "/rest/v1/documents"
    assert requests[1].url.path == "/rest/v1/documents"
    assert requests[1].headers["prefer"] == "return=representation"


def test_replace_chunks_deletes_existing_chunks_and_inserts_new_rows() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(201 if request.method == "POST" else 204, json=[] if request.method == "POST" else None)

    repository = SupabaseDocumentRepository(
        supabase_url="https://example.supabase.co",
        service_role_key="service-key",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    repository.replace_chunks(
        {"id": "doc-1", "user_id": "user-1", "status": "processing"},
        [
            {
                "document_id": "doc-1",
                "user_id": "user-1",
                "chunk_index": 0,
                "text": "hello",
                "page_number": 1,
                "qdrant_point_id": "point-1",
            }
        ],
    )

    assert [request.method for request in requests] == ["DELETE", "POST"]
    assert json.loads(requests[1].content)[0]["text"] == "hello"


def test_get_document_reads_one_row_by_id() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json=[{"id": "doc-1", "user_id": "user-1", "status": "ready"}],
        )

    repository = SupabaseDocumentRepository(
        supabase_url="https://example.supabase.co",
        service_role_key="service-key",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    document = repository.get_document("doc-1")

    assert document is not None
    assert document["id"] == "doc-1"
    assert requests[0].url.params["id"] == "eq.doc-1"


def test_get_document_returns_none_when_the_id_is_unknown() -> None:
    repository = SupabaseDocumentRepository(
        supabase_url="https://example.supabase.co",
        service_role_key="service-key",
        client=httpx.Client(
            transport=httpx.MockTransport(lambda _request: httpx.Response(200, json=[]))
        ),
    )

    assert repository.get_document("doc-9") is None


def test_list_documents_orders_by_creation() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json=[{"id": "doc-1", "status": "ready"}, {"id": "doc-2", "status": "failed"}],
        )

    repository = SupabaseDocumentRepository(
        supabase_url="https://example.supabase.co",
        service_role_key="service-key",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    documents = repository.list_documents()

    assert [document["id"] for document in documents] == ["doc-1", "doc-2"]
    assert requests[0].url.params["order"] == "created_at.asc"


def test_storage_downloads_encoded_object_path() -> None:
    seen_url = ""

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal seen_url
        seen_url = str(request.url)
        return httpx.Response(200, content=b"file bytes")

    storage = SupabaseDocumentStorage(
        supabase_url="https://example.supabase.co",
        service_role_key="service-key",
        bucket="contexta-documents",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    content = storage.download_document("user-1/folder name/file.pdf")

    assert content == b"file bytes"
    assert seen_url.endswith("/storage/v1/object/contexta-documents/user-1/folder%20name/file.pdf")


@pytest.mark.parametrize(
    "status_code,body",
    [
        (
            400,
            '{"statusCode":"404","error":"not_found",'
            '"message":"Object not found","code":"NoSuchKey"}',
        ),
        (404, '{"error":"not_found"}'),
    ],
    ids=["supabase-400", "plain-404"],
)
def test_storage_reports_a_missing_object_without_leaking_the_url(
    status_code: int,
    body: str,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, text=body)

    storage = SupabaseDocumentStorage(
        supabase_url="https://example.supabase.co",
        service_role_key="service-key",
        bucket="contexta-documents",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    with pytest.raises(UserVisibleError) as captured:
        storage.download_document("user-1/doc-1.pdf")

    message = str(captured.value)
    assert message == "Stored file is no longer available"
    assert "example.supabase.co" not in message
    assert "service-key" not in message


def test_prune_api_request_logs_deletes_past_retention_and_reports_the_count() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(204, headers={"content-range": "0-11/12"})

    repository = SupabaseDocumentRepository(
        supabase_url="https://example.supabase.co",
        service_role_key="service-key",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    pruned = repository.prune_api_request_logs(retention_days=90)

    assert pruned == 12
    assert requests[0].method == "DELETE"
    assert requests[0].url.path == "/rest/v1/api_request_logs"
    assert requests[0].headers["prefer"] == "count=exact"
    cutoff = requests[0].url.params["created_at"]
    assert cutoff.startswith("lt.")
    # The cutoff has to be ~90 days back, not a day or a week: a wrong sign here
    # quietly deletes the whole audit trail.
    cutoff_date = datetime.fromisoformat(cutoff.removeprefix("lt."))
    assert (datetime.now(timezone.utc) - cutoff_date).days == 90


def test_prune_api_request_logs_reports_zero_when_postgrest_omits_the_count() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(204)

    repository = SupabaseDocumentRepository(
        supabase_url="https://example.supabase.co",
        service_role_key="service-key",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert repository.prune_api_request_logs(retention_days=90) == 0
