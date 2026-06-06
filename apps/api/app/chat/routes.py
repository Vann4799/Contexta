from __future__ import annotations

import sys
from pathlib import Path
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

try:
    from contexta_rag.embeddings import create_embedding_provider
    from contexta_rag.prompts import build_rag_prompt
except ModuleNotFoundError:
    rag_package_path = Path(__file__).resolve().parents[4] / "packages" / "rag"
    sys.path.append(str(rag_package_path))
    from contexta_rag.embeddings import create_embedding_provider
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
                chunk_index=int(context["chunk_index"]),
                page_number=context["page_number"],
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
            chunk_index=chunk.chunk_index,
            page_number=chunk.page_number,
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
