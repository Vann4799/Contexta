from __future__ import annotations

import json

import httpx

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
