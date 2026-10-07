from __future__ import annotations

import time
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.apikeys.dependencies import (
    ApiKeyPrincipal,
    get_api_key_principal,
    get_api_key_repository,
    quota_headers,
)
from app.apikeys.repository import ApiKeyRepository
from app.chat.retrieval import QdrantRetriever
from app.chat.routes import get_retriever
from app.documents.models import DocumentResponse, DocumentType
from app.documents.repository import DocumentRepository
from app.documents.routes import get_document_repository
from app.export.builder import document_jsonl_lines, document_markdown
from app.export.routes import download_headers


router = APIRouter(prefix="/v1", tags=["v1"])
VALID_EXPORT_FORMATS = {"md", "jsonl"}
MAX_QUERY_CHARS = 500
MAX_REQUEST_DOCUMENT_IDS = 50


class RetrieveRequest(BaseModel):
    # extra="forbid" is a security control, not tidiness: a caller who typo'd
    # "document_id" for "document_ids" would otherwise have their filter silently
    # dropped and receive results from the whole workspace.
    model_config = ConfigDict(extra="forbid")

    query: str = Field(min_length=1, max_length=MAX_QUERY_CHARS)
    top_k: int = Field(default=5, ge=1, le=20)
    document_ids: list[str] | None = Field(
        default=None, max_length=MAX_REQUEST_DOCUMENT_IDS
    )
    doc_types: list[DocumentType] | None = Field(default=None, max_length=8)


class RetrievedChunk(BaseModel):
    document_id: str
    document_name: str
    doc_type: str
    chunk_index: int
    page_number: int | None
    section_path: str | None
    text: str
    score: float


class V1Document(BaseModel):
    id: str
    filename: str
    file_type: str
    status: str
    doc_type: str
    chunk_count: int
    indexed_at: datetime | None = None

    @classmethod
    def from_row(cls, document: DocumentResponse) -> "V1Document":
        return cls(
            id=document.id,
            filename=document.filename,
            file_type=document.file_type,
            status=document.status,
            doc_type=document.doc_type,
            chunk_count=document.chunk_count,
            indexed_at=document.indexed_at,
        )


def _reject(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


def _visible_document_ids(principal: ApiKeyPrincipal, requested: list[str] | None) -> list[str] | None:
    """Narrow a request to what this key may read, never widen it.

    Asking for a document outside the key's subset returns nothing rather than an error,
    so the response cannot be used to probe which other documents exist.
    """
    if not principal.document_ids:
        return requested
    allowed = set(principal.document_ids)
    if requested is None:
        return list(allowed)
    return [document_id for document_id in requested if document_id in allowed]


@router.post("/retrieve")
def retrieve(
    payload: RetrieveRequest,
    request: Request,
    principal: Annotated[ApiKeyPrincipal, Depends(get_api_key_principal)],
    retriever: Annotated[QdrantRetriever, Depends(get_retriever)],
) -> JSONResponse:
    document_ids = _visible_document_ids(principal, payload.document_ids)

    if document_ids == []:
        contexts: list[RetrievedChunk] = []
    else:
        raw_contexts = retriever.retrieve(
            user_id=principal.user_id,
            question=payload.query,
            document_ids=document_ids,
            top_k=payload.top_k,
            doc_types=payload.doc_types,
        )
        contexts = [RetrievedChunk.model_validate(context) for context in raw_contexts]

    return _respond(
        request,
        principal,
        {
            "data": [context.model_dump() for context in contexts],
            "meta": {
                "query": payload.query,
                "top_k": payload.top_k,
                "retrieved": len(contexts),
                "document_scope": "all" if not principal.document_ids else "subset",
            },
        },
    )


@router.get("/documents")
def list_documents(
    request: Request,
    principal: Annotated[ApiKeyPrincipal, Depends(get_api_key_principal)],
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
) -> JSONResponse:
    documents = [
        V1Document.from_row(document).model_dump()
        for document in repository.list_documents(principal.user_id)
        if principal.allows(document.id)
    ]
    return _respond(
        request,
        principal,
        {
            "data": documents,
            "meta": {"total": len(documents)},
        },
    )


@router.get("/documents/{document_id}/export")
def export_document(
    document_id: str,
    request: Request,
    principal: Annotated[ApiKeyPrincipal, Depends(get_api_key_principal)],
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
    document_format: Annotated[str, Query(alias="format")] = "md",
) -> Response:
    if document_format not in VALID_EXPORT_FORMATS:
        raise _reject(422, "invalid_request", "format must be md or jsonl")

    document = repository.get_document(principal.user_id, document_id)
    # One answer for "does not exist", "is not yours" and "this key may not read it":
    # a restricted key must not be able to confirm the existence of other documents.
    if document is None or not principal.allows(document_id):
        raise _reject(404, "document_not_found", "document not found")

    chunks = repository.list_document_chunks(principal.user_id, document_id)
    if not chunks:
        raise _reject(409, "document_not_exportable", "document has no indexed chunks yet")

    stem = document.filename.rsplit(".", 1)[0] or document.filename
    if document_format == "md":
        body = document_markdown(document, chunks).encode("utf-8")
        media_type = "text/markdown"
    else:
        body = b"".join(document_jsonl_lines(document, chunks))
        media_type = "application/x-ndjson"

    response = Response(
        content=body,
        media_type=media_type,
        headers={
            **download_headers(f"{stem}.{document_format}"),
            **quota_headers(principal),
        },
    )
    principal.finish(int((time.perf_counter() - request.state.started_at) * 1000), [document_id])
    return response


@router.get("/keys/me")
def key_self(
    request: Request,
    principal: Annotated[ApiKeyPrincipal, Depends(get_api_key_principal)],
    keys: Annotated[ApiKeyRepository, Depends(get_api_key_repository)],
) -> JSONResponse:
    row = keys.get_key(principal.user_id, principal.key_id)
    return _respond(
        request,
        principal,
        {
            "data": {
                "key_id": principal.key_id,
                "name": row["name"] if row else None,
                "scopes": principal.scopes,
                "document_scope": (
                    "all" if not principal.document_ids else len(principal.document_ids)
                ),
                "limits": {
                    "per_minute": principal.minute_limit,
                    "per_day": principal.day_limit,
                },
                "remaining": {
                    "minute": principal.remaining_minute,
                    "day": principal.remaining_day,
                },
            },
        },
    )


def _respond(
    request: Request,
    principal: ApiKeyPrincipal,
    body: dict[str, object],
) -> JSONResponse:
    latency_ms = int((time.perf_counter() - request.state.started_at) * 1000)
    response = JSONResponse(
        status_code=200,
        content=body,
        headers=quota_headers(principal),
    )
    hit_ids = sorted(
        {
            str(item["document_id"])
            for item in body.get("data", [])
            if isinstance(item, dict) and "document_id" in item
        }
    )
    principal.finish(latency_ms, hit_ids)
    return response


async def v1_aware_validation_error(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Keep /v1 on one error shape without touching the browser API's 422 body."""
    if request.url.path.startswith("/v1/"):
        return JSONResponse(
            status_code=422,
            content={
                "detail": {
                    "code": "invalid_request",
                    "message": "Request validation failed.",
                    "fields": jsonable_encoder(exc.errors()),
                }
            },
        )
    return JSONResponse(
        status_code=422,
        content={"detail": jsonable_encoder(exc.errors())},
    )
