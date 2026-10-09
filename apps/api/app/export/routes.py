from collections.abc import Iterator
from datetime import datetime, timezone
from typing import Annotated
import json
import logging
import zipfile
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.chat.repository import ChatRepository
from app.chat.routes import get_chat_repository
from app.core.config import Settings, get_settings
from app.documents.models import DocumentChunkResponse, DocumentResponse
from app.documents.repository import DocumentRepository
from app.documents.routes import get_document_repository
from app.export.builder import (
    build_manifest,
    conversation_record,
    document_jsonl_lines,
    document_markdown,
    json_line,
    workspace_header,
)


router = APIRouter(tags=["export"])
VALID_EXPORT_FORMATS = {"md", "jsonl"}
ZIP_MEDIA_TYPE = "application/zip"
logger = logging.getLogger(__name__)


class _PushStream:
    """Write-only target for ZipFile, so the archive leaves through HTTP one
    member at a time instead of being assembled in memory first."""

    def __init__(self) -> None:
        self._parts: list[bytes] = []
        self._size = 0

    def write(self, data: bytes) -> int:
        self._parts.append(data)
        self._size += len(data)
        return len(data)

    def tell(self) -> int:
        return self._size

    def seekable(self) -> bool:
        return False

    def flush(self) -> None:
        return None

    def drain(self) -> Iterator[bytes]:
        for part in self._parts:
            yield part
        self._parts.clear()


def export_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def embedding_arms(settings: Settings) -> list[dict[str, object]]:
    arms = [
        {
            "provider": settings.embedding_provider,
            "model": settings.embedding_model_name,
            "dimensions": settings.embedding_dimensions,
            "vector_name": settings.embedding_vector_name or None,
        }
    ]
    if settings.secondary_embedding_provider:
        arms.append(
            {
                "provider": settings.secondary_embedding_provider,
                "model": settings.secondary_embedding_model_name,
                "dimensions": settings.secondary_embedding_dimensions,
                "vector_name": settings.secondary_embedding_vector_name or None,
            }
        )
    return arms


def download_headers(filename: str) -> dict[str, str]:
    return {
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename, safe='')}",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    }


def _chunks_of(
    repository: DocumentRepository,
    user_id: str,
    document_id: str,
) -> list[DocumentChunkResponse]:
    chunks = repository.list_document_chunks(user_id, document_id)
    if not chunks:
        raise HTTPException(
            status_code=409,
            detail="document has no indexed chunks to export yet",
        )
    return chunks


@router.get("/documents/{document_id}/export")
def export_document(
    document_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
    document_format: Annotated[str, Query(alias="format")] = "md",
) -> Response:
    if document_format not in VALID_EXPORT_FORMATS:
        raise HTTPException(status_code=422, detail="format must be md or jsonl")

    document = repository.get_document(current_user.id, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="document not found")
    if document.status != "ready":
        raise HTTPException(
            status_code=409,
            detail="document indexing is not finished yet",
        )

    chunks = _chunks_of(repository, current_user.id, document_id)
    stem = document.filename.rsplit(".", 1)[0] or document.filename
    if document_format == "md":
        filename = f"{stem}.md"
        body = document_markdown(document, chunks).encode("utf-8")
        media_type = "text/markdown"
    else:
        filename = f"{stem}.jsonl"
        body = b"".join(document_jsonl_lines(document, chunks))
        media_type = "application/x-ndjson"

    return Response(
        content=body,
        media_type=media_type,
        headers=download_headers(filename),
    )


@router.get("/export/workspace")
def export_workspace(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
    chat_repository: Annotated[ChatRepository, Depends(get_chat_repository)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    documents = repository.list_documents(current_user.id)
    generated_at = export_timestamp()
    filename = f"contexta-workspace-{generated_at[:10]}.zip"
    media_type = ZIP_MEDIA_TYPE

    return StreamingResponse(
        _workspace_bytes(
            current_user.id,
            documents,
            repository,
            chat_repository,
            settings,
            generated_at,
        ),
        media_type=media_type,
        headers=download_headers(filename),
    )


def _workspace_bytes(
    user_id: str,
    documents: list[DocumentResponse],
    repository: DocumentRepository,
    chat_repository: ChatRepository,
    settings: Settings,
    generated_at: str,
) -> Iterator[bytes]:
    sink = _PushStream()
    archive = zipfile.ZipFile(sink, "w", zipfile.ZIP_DEFLATED)
    counts: dict[str, int] = {}

    try:
        with archive.open("workspace.md", "w", force_zip64=True) as entry:
            entry.write(workspace_header(user_id, documents, generated_at))
            for document in documents:
                chunks = repository.list_document_chunks(user_id, document.id)
                counts[document.id] = len(chunks)
                entry.write(document_markdown(document, chunks).encode("utf-8"))
                # Chunks are read again for chunks.jsonl on purpose: holding the
                # whole corpus in memory once to avoid the second read is exactly
                # what this endpoint must not do.
                yield from sink.drain()

        with archive.open("chunks.jsonl", "w", force_zip64=True) as entry:
            for document in documents:
                chunks = repository.list_document_chunks(user_id, document.id)
                for line in document_jsonl_lines(document, chunks):
                    entry.write(line)
                yield from sink.drain()

        archive.writestr(
            "manifest.json",
            json.dumps(
                build_manifest(
                    user_id,
                    documents,
                    embedding_arms(settings),
                    settings.qdrant_collection,
                    counts,
                    generated_at,
                ),
                indent=2,
                ensure_ascii=False,
            ),
        )
        yield from sink.drain()

        with archive.open("conversations.jsonl", "w", force_zip64=True) as entry:
            for session in chat_repository.list_sessions(user_id):
                for message in chat_repository.list_messages(user_id, session.id):
                    entry.write(
                        json_line(conversation_record(session, message))
                    )
                yield from sink.drain()
    except Exception:
        logger.exception("workspace export failed mid-stream for user %s", user_id)
        raise
    finally:
        archive.close()

    yield from sink.drain()
