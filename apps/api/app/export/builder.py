from __future__ import annotations

import json
from collections.abc import Iterator
from datetime import datetime, timezone
from typing import Any

from app.chat.models import ChatMessageResponse, ChatSessionResponse
from app.documents.models import DocumentChunkResponse, DocumentResponse

MAX_TOP_SECTIONS = 8
STRATEGY = "document_window"


def utc_stamp(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def document_section_paths(chunks: list[DocumentChunkResponse]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for chunk in chunks:
        section = chunk.section_path
        if not section or section in seen:
            continue
        seen.add(section)
        ordered.append(section)
    return ordered[:MAX_TOP_SECTIONS]


def document_markdown(
    document: DocumentResponse,
    chunks: list[DocumentChunkResponse],
) -> str:
    lines = [
        f"## {document.filename}",
        "",
        f"- document_id: {document.id}",
        f"- doc_type: {document.doc_type}",
        f"- status: {document.status}",
        f"- chunks: {len(chunks)}",
        f"- doc_version: {document.doc_version or '-'}",
        f"- source_url: {document.source_url or '-'}",
        f"- indexed_at: {utc_stamp(document.indexed_at) or '-'}",
        f"- chunker_version: {document.chunker_version or '-'}",
        f"- embedding_model: {document.embedding_model or '-'}",
    ]
    sections = document_section_paths(chunks)
    if sections:
        lines.append(f"- sections: {', '.join(sections)}")
    lines.append("")

    for chunk in chunks:
        location = [f"chunk {chunk.chunk_index}"]
        if chunk.page_number is not None:
            location.append(f"page {chunk.page_number}")
        if chunk.section_path:
            location.append(chunk.section_path)
        lines.append(f"### {' - '.join(location)}")
        lines.append("")
        lines.append(chunk.text)
        lines.append("")

    return "\n".join(lines)


def chunk_record(
    document: DocumentResponse,
    chunk: DocumentChunkResponse,
) -> dict[str, Any]:
    return {
        "id": chunk.qdrant_point_id,
        "document_id": document.id,
        "document_name": document.filename,
        "doc_type": document.doc_type,
        "chunk_index": chunk.chunk_index,
        "page_number": chunk.page_number,
        "section_path": chunk.section_path,
        "token_count": chunk.token_count,
        "char_count": chunk.char_count,
        "is_table": chunk.is_table,
        "text": chunk.text,
        "metadata": {
            "chunker_version": document.chunker_version,
            "embedding_model": document.embedding_model,
            "embedding_dimensions": document.embedding_dimensions,
        },
    }


def json_line(record: dict[str, Any]) -> bytes:
    return (json.dumps(record, ensure_ascii=False) + "\n").encode("utf-8")


def document_jsonl_lines(
    document: DocumentResponse,
    chunks: list[DocumentChunkResponse],
) -> Iterator[bytes]:
    for chunk in chunks:
        yield json_line(chunk_record(document, chunk))


def conversation_record(
    session: ChatSessionResponse,
    message: ChatMessageResponse,
) -> dict[str, Any]:
    # The chunk text lives in chunks.jsonl; a citation only needs to point back
    # to it, so the transcript stays small.
    return {
        "session_id": session.id,
        "session_title": session.title,
        "message_id": message.id,
        "role": message.role,
        "content": message.content,
        "created_at": message.created_at,
        "citations": [
            {
                "source_number": citation.source_number,
                "document_id": citation.document_id,
                "document_name": citation.document_name,
                "chunk_index": citation.chunk_index,
                "page_number": citation.page_number,
                "section_path": citation.section_path,
            }
            for citation in message.citations
        ],
    }


def build_manifest(
    user_id: str,
    documents: list[DocumentResponse],
    arms: list[dict[str, Any]],
    collection: str,
    chunk_counts: dict[str, int],
    generated_at: str,
) -> dict[str, Any]:
    total_chunks = sum(chunk_counts.values())
    chunker_versions = sorted(
        {document.chunker_version for document in documents if document.chunker_version}
    )
    return {
        "export": {
            "product": "contexta",
            "kind": "workspace",
            "generated_at": generated_at,
            "user_id": user_id,
        },
        "totals": {
            "documents": len(documents),
            "chunks": total_chunks,
        },
        "chunking": {
            "strategy": STRATEGY,
            "chunker_versions": chunker_versions,
        },
        "embeddings": {
            "collection": collection,
            "arms": arms,
        },
        "documents": [
            {
                "id": document.id,
                "filename": document.filename,
                "doc_type": document.doc_type,
                "status": document.status,
                "chunks": chunk_counts.get(document.id, 0),
                "doc_version": document.doc_version,
                "source_url": document.source_url,
                "created_at": utc_stamp(document.created_at),
                "indexed_at": utc_stamp(document.indexed_at),
                "chunker_version": document.chunker_version,
                "embedding_model": document.embedding_model,
                "embedding_dimensions": document.embedding_dimensions,
            }
            for document in documents
        ],
    }


def workspace_header(user_id: str, documents: list[DocumentResponse], generated_at: str) -> bytes:
    return (
        "# Contexta workspace export\n\n"
        f"- user_id: {user_id}\n"
        f"- documents: {len(documents)}\n"
        f"- generated_at: {generated_at}\n\n"
    ).encode("utf-8")
