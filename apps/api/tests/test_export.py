from __future__ import annotations

import io
import json
import zipfile
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.chat.models import ChatCitation
from app.chat.repository import InMemoryChatRepository
from app.chat.routes import get_chat_repository
from app.core.config import Settings, get_settings
from app.documents.models import DocumentCreate, DocumentResponse
from app.documents.repository import InMemoryDocumentRepository
from app.documents.routes import get_document_repository
from app.main import app


client = TestClient(app)

USER_ID = "user-export-1"
OTHER_USER_ID = "user-export-2"
INDEXED_AT = datetime(2026, 10, 7, 4, 30, tzinfo=timezone.utc)


def override_user(user_id: str = USER_ID) -> CurrentUser:
    return CurrentUser(id=user_id, email="user@example.com", role="authenticated")


def _settings() -> Settings:
    return Settings(
        environment="test",
        qdrant_collection="contexta_chunks_v3",
        embedding_provider="remote",
        embedding_model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        embedding_dimensions=384,
        embedding_vector_name="minilm",
        secondary_embedding_provider="openrouter",
        secondary_embedding_model_name="openai/text-embedding-3-small",
        secondary_embedding_dimensions=1536,
        secondary_embedding_vector_name="openai",
    )


def ready_document(
    repository: InMemoryDocumentRepository,
    user_id: str,
    filename: str,
    chunk_count: int,
    doc_type: str = "thesis",
) -> DocumentResponse:
    document = repository.create_document(
        user_id,
        DocumentCreate(
            filename=filename,
            file_type="pdf",
            file_size=1024,
            storage_path=f"{user_id}/{filename}",
            doc_type=doc_type,
        ),
    )
    updated = repository.update_document_metadata(
        user_id,
        document.id,
        {
            "status": "ready",
            "chunk_count": chunk_count,
            "indexed_at": INDEXED_AT,
            "embedding_model": document_embedding_model(),
            "embedding_dimensions": 384,
            "chunker_version": "window-v2",
        },
    )
    assert updated is not None
    return updated


def document_embedding_model() -> str:
    return "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


def add_chunk(
    repository: InMemoryDocumentRepository,
    document: DocumentResponse,
    chunk_index: int,
    text: str,
    page_number: int | None = None,
    section_path: str | None = None,
) -> None:
    repository.add_chunks(
        [
            {
                "document_id": document.id,
                "user_id": document.user_id,
                "chunk_index": chunk_index,
                "text": text,
                "page_number": page_number,
                "section_path": section_path,
                "is_table": False,
                "char_count": len(text),
                "token_count": len(text) // 4,
                "qdrant_point_id": f"point-{document.id}-{chunk_index}",
            }
        ]
    )


def override_repositories(
    documents: InMemoryDocumentRepository,
    chats: InMemoryChatRepository,
) -> None:
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_document_repository] = lambda: documents
    app.dependency_overrides[get_chat_repository] = lambda: chats
    app.dependency_overrides[get_settings] = _settings


def read_zip(response) -> zipfile.ZipFile:
    assert response.status_code == 200, response.text
    return zipfile.ZipFile(io.BytesIO(response.content))


def setup_module(module) -> None:
    app.dependency_overrides.clear()


def test_workspace_zip_carries_markdown_chunks_manifest_and_conversations() -> None:
    documents = InMemoryDocumentRepository()
    chats = InMemoryChatRepository()
    document = ready_document(documents, USER_ID, "skripsi.pdf", 2)
    add_chunk(documents, document, 0, "Bab satu berisi latar belakang.", 12, "BAB I > Latar belakang")
    add_chunk(documents, document, 1, "Bab dua berisi landasan teori.", 20, "BAB II > Gamifikasi")

    session = chats.create_session(USER_ID, "Riset skripsi")
    chats.create_message(
        USER_ID,
        session.id,
        "user",
        "Apa isi bab dua?",
    )
    chats.create_message(
        USER_ID,
        session.id,
        "assistant",
        "Bab dua membahas gamifikasi. [Source 1]",
        [
            ChatCitation(
                source_number=1,
                document_id=document.id,
                document_name=document.filename,
                chunk_index=1,
                page_number=20,
                doc_type="thesis",
                section_path="BAB II > Gamifikasi",
                text="Bab dua berisi landasan teori.",
                score=0.71,
            )
        ],
    )
    override_repositories(documents, chats)

    response = client.get("/export/workspace")
    archive = read_zip(response)

    assert sorted(archive.namelist()) == [
        "chunks.jsonl",
        "conversations.jsonl",
        "manifest.json",
        "workspace.md",
    ]
    assert response.headers["content-type"].startswith("application/zip")
    assert "no-store" in response.headers["cache-control"]

    markdown = archive.read("workspace.md").decode("utf-8")
    assert "## skripsi.pdf" in markdown
    assert "chunk 1 - page 20 - BAB II > Gamifikasi" in markdown
    assert "Bab dua berisi landasan teori." in markdown

    lines = [json.loads(line) for line in archive.read("chunks.jsonl").splitlines()]
    assert [line["chunk_index"] for line in lines] == [0, 1]
    assert lines[1]["document_name"] == "skripsi.pdf"
    assert lines[1]["doc_type"] == "thesis"
    assert lines[1]["id"] == f"point-{document.id}-1"
    assert lines[1]["metadata"]["chunker_version"] == "window-v2"
    assert lines[1]["metadata"]["embedding_dimensions"] == 384

    assert archive.testzip() is None
    setup_module(None)


def test_manifest_reports_every_arm_dimension_and_total() -> None:
    documents = InMemoryDocumentRepository()
    chats = InMemoryChatRepository()
    document = ready_document(documents, USER_ID, "a.pdf", 1)
    add_chunk(documents, document, 0, "Isi dokumen A.")
    other = ready_document(documents, USER_ID, "b.pdf", 3, doc_type="report")
    add_chunk(documents, other, 0, "Isi dokumen B.")
    override_repositories(documents, chats)

    manifest = json.loads(read_zip(client.get("/export/workspace")).read("manifest.json"))

    assert manifest["export"]["product"] == "contexta"
    assert manifest["export"]["user_id"] == USER_ID
    assert manifest["totals"] == {"documents": 2, "chunks": 2}
    assert manifest["chunking"] == {
        "strategy": "document_window",
        "chunker_versions": ["window-v2"],
    }
    assert manifest["embeddings"]["collection"] == "contexta_chunks_v3"
    assert [arm["dimensions"] for arm in manifest["embeddings"]["arms"]] == [384, 1536]
    assert manifest["embeddings"]["arms"][1]["model"] == "openai/text-embedding-3-small"
    assert {entry["filename"] for entry in manifest["documents"]} == {"a.pdf", "b.pdf"}
    setup_module(None)


def test_a_second_arm_is_only_listed_when_it_is_configured() -> None:
    documents = InMemoryDocumentRepository()
    chats = InMemoryChatRepository()
    document = ready_document(documents, USER_ID, "a.pdf", 1)
    add_chunk(documents, document, 0, "Isi dokumen A.")
    override_repositories(documents, chats)
    app.dependency_overrides[get_settings] = lambda: Settings(
        environment="test",
        embedding_provider="remote",
    )

    manifest = json.loads(read_zip(client.get("/export/workspace")).read("manifest.json"))

    assert len(manifest["embeddings"]["arms"]) == 1
    setup_module(None)


def test_export_never_reads_another_users_documents() -> None:
    documents = InMemoryDocumentRepository()
    chats = InMemoryChatRepository()
    mine = ready_document(documents, USER_ID, "mine.pdf", 1)
    add_chunk(documents, mine, 0, "Milik saya.")
    theirs = ready_document(documents, OTHER_USER_ID, "theirs.pdf", 1)
    add_chunk(documents, theirs, 0, "Milik orang lain.")
    chats.create_session(OTHER_USER_ID, "Percakapan orang lain")
    override_repositories(documents, chats)

    archive = read_zip(client.get("/export/workspace"))
    lines = [json.loads(line) for line in archive.read("chunks.jsonl").splitlines()]

    assert [line["document_name"] for line in lines] == ["mine.pdf"]
    assert "theirs.pdf" not in archive.read("workspace.md").decode("utf-8")
    assert archive.read("conversations.jsonl") == b""
    assert archive.read("manifest.json").decode("utf-8").count("theirs.pdf") == 0

    forbidden = client.get(f"/documents/{theirs.id}/export")
    assert forbidden.status_code == 404
    setup_module(None)


def test_document_export_supports_markdown_and_jsonl() -> None:
    documents = InMemoryDocumentRepository()
    chats = InMemoryChatRepository()
    document = ready_document(documents, USER_ID, "Laporan TA.pdf", 2)
    add_chunk(documents, document, 0, "Paragraf pertama.", 3, "BAB I > Latar belakang")
    add_chunk(documents, document, 1, "Paragraf kedua.", 4)
    override_repositories(documents, chats)

    markdown = client.get(f"/documents/{document.id}/export")
    lines = client.get(f"/documents/{document.id}/export?format=jsonl")

    assert markdown.status_code == 200
    assert markdown.headers["content-type"].startswith("text/markdown")
    assert markdown.headers["content-disposition"] == (
        "attachment; filename*=UTF-8''Laporan%20TA.md"
    )
    assert "## Laporan TA" in markdown.text
    assert markdown.text.index("Paragraf pertama.") < markdown.text.index("Paragraf kedua.")

    assert lines.status_code == 200
    assert lines.headers["content-type"].startswith("application/x-ndjson")
    records = [json.loads(line) for line in lines.text.splitlines()]
    assert [record["text"] for record in records] == ["Paragraf pertama.", "Paragraf kedua."]
    setup_module(None)


def test_rejects_an_unknown_export_format() -> None:
    documents = InMemoryDocumentRepository()
    chats = InMemoryChatRepository()
    document = ready_document(documents, USER_ID, "a.pdf", 1)
    add_chunk(documents, document, 0, "Isi.")
    override_repositories(documents, chats)

    response = client.get(f"/documents/{document.id}/export?format=docx")

    assert response.status_code == 422
    setup_module(None)


def test_a_document_without_indexed_chunks_is_not_exportable() -> None:
    documents = InMemoryDocumentRepository()
    chats = InMemoryChatRepository()
    document = ready_document(documents, USER_ID, "kosong.pdf", 0)
    override_repositories(documents, chats)

    response = client.get(f"/documents/{document.id}/export")

    assert response.status_code == 409
    assert "no indexed chunks" in response.json()["detail"]
    setup_module(None)


@pytest.mark.parametrize("status", ["processing", "failed"])
def test_a_document_that_is_not_ready_is_not_exportable(status: str) -> None:
    """Re-indexing resets the status but keeps the previous attempt's chunk rows."""
    documents = InMemoryDocumentRepository()
    chats = InMemoryChatRepository()
    document = ready_document(documents, USER_ID, "a.pdf", 1)
    add_chunk(documents, document, 0, "Isi dari upaya indeks sebelumnya.")
    documents.update_document_metadata(USER_ID, document.id, {"status": status})
    override_repositories(documents, chats)

    response = client.get(f"/documents/{document.id}/export")

    assert response.status_code == 409
    assert "indexing is not finished" in response.json()["detail"]
    setup_module(None)


def test_conversations_keep_chunk_references_without_repeating_text() -> None:
    documents = InMemoryDocumentRepository()
    chats = InMemoryChatRepository()
    document = ready_document(documents, USER_ID, "a.pdf", 1)
    add_chunk(documents, document, 0, "Isi dokumen.")
    session = chats.create_session(USER_ID, "Sesi")
    chats.create_message(
        USER_ID,
        session.id,
        "assistant",
        "Jawaban. [Source 1]",
        [
            ChatCitation(
                source_number=1,
                document_id=document.id,
                document_name="a.pdf",
                chunk_index=0,
                page_number=7,
                doc_type="thesis",
                section_path="BAB I > Latar belakang",
                text="Isi dokumen.",
                score=0.6,
            )
        ],
    )
    override_repositories(documents, chats)

    archive = read_zip(client.get("/export/workspace"))
    records = [
        json.loads(line)
        for line in archive.read("conversations.jsonl").splitlines()
    ]

    assert [(record["role"], record["content"]) for record in records] == [
        ("assistant", "Jawaban. [Source 1]")
    ]
    citation = records[0]["citations"][0]
    assert citation["document_name"] == "a.pdf"
    assert citation["chunk_index"] == 0
    assert citation["section_path"] == "BAB I > Latar belakang"
    assert "text" not in citation
    setup_module(None)


def test_workspace_requires_authentication() -> None:
    app.dependency_overrides.clear()

    response = client.get("/export/workspace", headers={})

    assert response.status_code in {401, 403}


def test_browser_can_read_the_export_filename_from_a_cross_origin_call() -> None:
    """Without CORS exposure the web app has to guess the downloaded filename."""
    documents = InMemoryDocumentRepository()
    chats = InMemoryChatRepository()
    document = ready_document(documents, USER_ID, "skripsi.pdf", 1)
    add_chunk(documents, document, 0, "Bab satu berisi latar belakang.", 12)
    override_repositories(documents, chats)

    response = client.get(
        f"/documents/{document.id}/export?format=md",
        headers={"Origin": "http://localhost:3000"},
    )

    assert response.status_code == 200, response.text
    exposed = response.headers.get("access-control-expose-headers", "")
    assert "content-disposition" in exposed.lower()
    setup_module(None)
