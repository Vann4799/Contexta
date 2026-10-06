from __future__ import annotations

import sys
from pathlib import Path
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

try:
    from contexta_rag.embeddings import create_embedding_provider, embedding_model_label
    from contexta_rag.prompts import build_rag_prompt
except ModuleNotFoundError:
    rag_package_path = Path(__file__).resolve().parents[4] / "packages" / "rag"
    sys.path.append(str(rag_package_path))
    from contexta_rag.embeddings import create_embedding_provider, embedding_model_label
    from contexta_rag.prompts import build_rag_prompt

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.chat.llm import AnswerGenerator, DeepSeekAnswerGenerator
from app.chat.models import (
    ChatCitation,
    ChatQueryRequest,
    ChatQueryResponse,
    ChatSessionCreate,
    ChatSessionMessageRequest,
    ChatSessionMessageResponse,
    ChatMessageResponse,
    ChatSessionResponse,
)
from app.chat.repository import (
    ChatRepository,
    SupabaseChatRepository,
    chat_repository,
)
from app.chat.retrieval import QdrantRetriever
from app.documents.repository import (
    DocumentRepository,
    SupabaseDocumentRepository,
    document_repository,
)
from app.core.config import Settings, get_settings


router = APIRouter(prefix="/chat", tags=["chat"])
MAX_AUTO_SESSION_TITLE_CHARS = 80
COUNT_QUESTION_PATTERN = re.compile(r"\b(berapa|jumlah|total|count|many)\b", re.IGNORECASE)
COUNT_SUBJECT_PATTERN = re.compile(r"\b(postingan|posting|post|konten|entry|entri|baris|row|rows)\b", re.IGNORECASE)
COUNT_TARGET_PATTERN = re.compile(
    r"(?:nama|user|pengguna|creator|kreator)\s+(?:dengan\s+nama\s+)?([@#]?[A-Za-z0-9_.-]+)",
    re.IGNORECASE,
)
ROW_TIMESTAMP_PATTERN = re.compile(r"(?=\b\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}:\d{2}\b)")
ROW_START_PATTERN = re.compile(r"^\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}:\d{2}\b")
HIGHEST_METRIC_PATTERN = re.compile(r"\b(paling\s+tinggi|tertinggi|terbesar|highest|max(?:imum)?)\b", re.IGNORECASE)
METRIC_ALIASES = {
    "view": ("view", "views", "tampilan"),
    "like": ("like", "likes"),
    "comment": ("comment", "comments", "komentar"),
    "point": ("point", "points", "poin"),
}
ROW_METRICS_PATTERN = re.compile(
    r"^(?P<timestamp>\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}:\d{2})\s+"
    r"(?P<email>\S+@\S+)\s+"
    r"(?P<name>.+?)\s+"
    r"(?P<uid>\d{8,})\s+"
    r"(?P<link>https?://\S+)\s+"
    r"(?P<content_type>.+?)\s+"
    r"(?P<channel>X\s+\(Twitter\)|Instagram|TikTok|Telegram|LinkedIn)\s+"
    r"(?P<point>-?\d+)\s+"
    r"(?P<view>-?\d+)\s+"
    r"(?P<like>-?\d+)\s+"
    r"(?P<comment>-?\d+)\b",
    re.IGNORECASE,
)


def build_auto_session_title(question: str) -> str:
    title = " ".join(question.split())
    if len(title) <= MAX_AUTO_SESSION_TITLE_CHARS:
        return title
    return f"{title[:MAX_AUTO_SESSION_TITLE_CHARS - 1].rstrip()}..."


def get_chat_repository(
    settings: Annotated[Settings, Depends(get_settings)],
) -> ChatRepository:
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseChatRepository(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return chat_repository


def get_document_repository(
    settings: Annotated[Settings, Depends(get_settings)],
) -> DocumentRepository:
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseDocumentRepository(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return document_repository


def get_retriever(
    settings: Annotated[Settings, Depends(get_settings)],
) -> QdrantRetriever:
    return QdrantRetriever(
        qdrant_url=settings.qdrant_url,
        collection_name=settings.qdrant_collection,
        embedding_provider=create_embedding_provider(
            provider_name=settings.embedding_provider,
            dimensions=settings.embedding_dimensions,
            model_name=settings.embedding_model_name,
            device=settings.embedding_device or None,
            remote_url=settings.embedding_remote_url,
        ),
        api_key=settings.qdrant_api_key,
        expected_dimensions=settings.embedding_dimensions,
        expected_model_label=embedding_model_label(
            settings.embedding_provider,
            settings.embedding_model_name,
        ),
    )


def get_answer_generator(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AnswerGenerator:
    return DeepSeekAnswerGenerator(
        api_key=settings.deepseek_api_key,
        model=settings.deepseek_model,
        max_tokens=settings.deepseek_max_tokens,
    )


def build_chat_response(answer: str, contexts: list[dict[str, object]]) -> ChatQueryResponse:
    return ChatQueryResponse(
        answer=answer,
        citations=[
            ChatCitation(
                source_number=index,
                document_id=str(context["document_id"]),
                document_name=str(context["document_name"]),
                doc_type=str(context.get("doc_type") or "unclassified"),
                chunk_index=int(context["chunk_index"]),
                page_number=context["page_number"],
                section_path=context.get("section_path"),
                text=str(context["text"]),
                score=float(context["score"]),
            )
            for index, context in enumerate(contexts, start=1)
        ],
    )


def extract_count_target(question: str) -> str | None:
    match = COUNT_TARGET_PATTERN.search(question)
    if not match:
        return None
    return match.group(1).strip(".,:;!?()[]{}\"'")


def split_extracted_table_rows(text: str) -> list[str]:
    return [
        part.strip()
        for part in ROW_TIMESTAMP_PATTERN.split(text)
        if ROW_START_PATTERN.match(part.strip())
    ]


def requested_metric(question: str) -> str | None:
    normalized_question = question.lower()
    for metric, aliases in METRIC_ALIASES.items():
        if any(re.search(rf"\b{re.escape(alias)}\b", normalized_question) for alias in aliases):
            return metric
    return None


def build_highest_metric_response(
    question: str,
    user_id: str,
    document_ids: list[str] | None,
    repository: DocumentRepository,
) -> ChatQueryResponse | None:
    if not document_ids or len(document_ids) != 1:
        return None
    if not HIGHEST_METRIC_PATTERN.search(question):
        return None

    metric = requested_metric(question)
    if not metric:
        return None

    document = repository.get_document(user_id, document_ids[0])
    if not document:
        return None

    best_row: str | None = None
    best_chunk = None
    best_values: dict[str, str] | None = None
    best_metric = None
    for chunk in repository.list_document_chunks(user_id, document.id):
        for row in split_extracted_table_rows(chunk.text):
            match = ROW_METRICS_PATTERN.search(row)
            if not match:
                continue

            values = match.groupdict()
            metric_value = int(values[metric])
            if best_metric is None or metric_value > best_metric:
                best_metric = metric_value
                best_values = values
                best_row = row
                best_chunk = chunk

    if best_metric is None or best_values is None or best_row is None or best_chunk is None:
        return ChatQueryResponse(
            answer=(
                f"Saya belum bisa menghitung {metric} tertinggi dari dokumen {document.filename} "
                "karena struktur baris tabel hasil ekstraksi tidak cukup jelas."
            ),
            citations=[],
        )

    citations = [
        ChatCitation(
            source_number=1,
            document_id=best_chunk.document_id,
            document_name=document.filename,
            doc_type=document.doc_type,
            chunk_index=best_chunk.chunk_index,
            page_number=best_chunk.page_number,
            section_path=best_chunk.section_path,
            text=best_row,
            score=1.0,
        )
    ]
    return ChatQueryResponse(
        answer=(
            f"{metric.capitalize()} paling tinggi di dokumen {document.filename} adalah "
            f"{best_metric:,} pada creator {best_values['name']} ({best_values['email']}). "
            f"Postingan tersebut berada pada {best_values['timestamp']} melalui "
            f"{best_values['channel']} dengan tipe konten {best_values['content_type']}. "
            f"Link: {best_values['link']}. Angka ini dihitung langsung dari seluruh baris "
            "tabel hasil ekstraksi dokumen, bukan dari sampel source retrieval."
        ),
        citations=citations,
    )


def build_exact_count_response(
    question: str,
    user_id: str,
    document_ids: list[str] | None,
    repository: DocumentRepository,
) -> ChatQueryResponse | None:
    if not document_ids or len(document_ids) != 1:
        return None
    if not COUNT_QUESTION_PATTERN.search(question) or not COUNT_SUBJECT_PATTERN.search(question):
        return None

    target = extract_count_target(question)
    if not target:
        return None

    document = repository.get_document(user_id, document_ids[0])
    if not document:
        return None

    target_pattern = re.compile(re.escape(target), re.IGNORECASE)
    matching_records: list[tuple[object, str]] = []
    total_occurrences = 0
    saw_table_rows = False
    for chunk in repository.list_document_chunks(user_id, document.id):
        rows = split_extracted_table_rows(chunk.text)
        if rows:
            saw_table_rows = True
            for row in rows:
                if target_pattern.search(row):
                    matching_records.append((chunk, row))
            continue

        occurrences = target_pattern.findall(chunk.text)
        if occurrences:
            total_occurrences += len(occurrences)
            matching_records.append((chunk, chunk.text))

    total_matches = len(matching_records) if saw_table_rows else total_occurrences
    match_unit = "postingan/baris" if saw_table_rows else "kemunculan teks"

    if total_matches == 0:
        return ChatQueryResponse(
            answer=(
                f"Saya tidak menemukan nama \"{target}\" di dokumen {document.filename}. "
                "Perhitungan ini dilakukan dari seluruh teks hasil ekstraksi dokumen, bukan hanya source hasil pencarian."
            ),
            citations=[],
        )

    citations = [
        ChatCitation(
            source_number=index,
            document_id=chunk.document_id,
            document_name=document.filename,
            doc_type=document.doc_type,
            chunk_index=chunk.chunk_index,
            page_number=chunk.page_number,
            section_path=chunk.section_path,
            text=record_text,
            score=1.0,
        )
        for index, (chunk, record_text) in enumerate(matching_records[:5], start=1)
    ]
    return ChatQueryResponse(
        answer=(
            f"Saya menemukan {total_matches} {match_unit} untuk nama \"{target}\" "
            f"di dokumen {document.filename}. Angka ini dihitung langsung dari seluruh "
            "teks hasil ekstraksi dokumen. Untuk dokumen tabel, Contexta menghitung baris "
            "berdasarkan timestamp postingan, sehingga satu postingan tidak dihitung dua kali "
            "hanya karena nama juga muncul di email atau link. Perhitungan ini bukan dari "
            "sampel source retrieval."
        ),
        citations=citations,
    )


@router.post("/query", response_model=ChatQueryResponse)
def query_chat(
    payload: ChatQueryRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    document_repository: Annotated[DocumentRepository, Depends(get_document_repository)],
    retriever: Annotated[QdrantRetriever, Depends(get_retriever)],
    answer_generator: Annotated[AnswerGenerator, Depends(get_answer_generator)],
) -> ChatQueryResponse:
    highest_metric_response = build_highest_metric_response(
        payload.question,
        current_user.id,
        payload.document_ids,
        document_repository,
    )
    if highest_metric_response:
        return highest_metric_response

    exact_count_response = build_exact_count_response(
        payload.question,
        current_user.id,
        payload.document_ids,
        document_repository,
    )
    if exact_count_response:
        return exact_count_response

    contexts = retriever.retrieve(
        user_id=current_user.id,
        question=payload.question,
        document_ids=payload.document_ids,
    )
    if not contexts:
        return ChatQueryResponse(
            answer="The document context is insufficient to answer that question.",
            citations=[],
        )

    prompt = build_rag_prompt(payload.question, contexts)
    try:
        answer = answer_generator.generate_answer(prompt)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return build_chat_response(answer, contexts)


@router.get("/sessions", response_model=list[ChatSessionResponse])
def list_chat_sessions(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[ChatRepository, Depends(get_chat_repository)],
) -> list[ChatSessionResponse]:
    return repository.list_sessions(current_user.id)


@router.post(
    "/sessions",
    response_model=ChatSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_chat_session(
    payload: ChatSessionCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[ChatRepository, Depends(get_chat_repository)],
) -> ChatSessionResponse:
    return repository.create_session(current_user.id, payload.title)


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageResponse])
def list_chat_messages(
    session_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[ChatRepository, Depends(get_chat_repository)],
) -> list[ChatMessageResponse]:
    if not repository.get_session(current_user.id, session_id):
        raise HTTPException(status_code=403, detail="chat session is not accessible")
    return repository.list_messages(current_user.id, session_id)


@router.post(
    "/sessions/{session_id}/messages",
    response_model=ChatSessionMessageResponse,
)
def create_chat_message(
    session_id: str,
    payload: ChatSessionMessageRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[ChatRepository, Depends(get_chat_repository)],
    document_repository: Annotated[DocumentRepository, Depends(get_document_repository)],
    retriever: Annotated[QdrantRetriever, Depends(get_retriever)],
    answer_generator: Annotated[AnswerGenerator, Depends(get_answer_generator)],
) -> ChatSessionMessageResponse:
    session = repository.get_session(current_user.id, session_id)
    if not session:
        raise HTTPException(status_code=403, detail="chat session is not accessible")

    existing_messages = repository.list_messages(current_user.id, session_id)
    if session.title == "New chat" and not existing_messages:
        repository.update_session_activity(
            current_user.id,
            session_id,
            build_auto_session_title(payload.question),
        )

    repository.create_message(
        current_user.id,
        session_id,
        "user",
        payload.question,
    )
    highest_metric_response = build_highest_metric_response(
        payload.question,
        current_user.id,
        payload.document_ids,
        document_repository,
    )
    if highest_metric_response:
        chat_response = highest_metric_response
    else:
        exact_count_response = build_exact_count_response(
            payload.question,
            current_user.id,
            payload.document_ids,
            document_repository,
        )
        if exact_count_response:
            chat_response = exact_count_response
        else:
            contexts = retriever.retrieve(
                user_id=current_user.id,
                question=payload.question,
                document_ids=payload.document_ids,
            )
            if contexts:
                prompt = build_rag_prompt(payload.question, contexts)
                try:
                    answer = answer_generator.generate_answer(prompt)
                except Exception as exc:
                    raise HTTPException(status_code=502, detail=str(exc)) from exc
                chat_response = build_chat_response(answer, contexts)
            else:
                chat_response = ChatQueryResponse(
                    answer="The document context is insufficient to answer that question.",
                    citations=[],
                )

    repository.create_message(
        current_user.id,
        session_id,
        "assistant",
        chat_response.answer,
        citations=chat_response.citations,
    )
    repository.update_session_activity(current_user.id, session_id)
    return ChatSessionMessageResponse(
        session_id=session_id,
        answer=chat_response.answer,
        citations=chat_response.citations,
    )
