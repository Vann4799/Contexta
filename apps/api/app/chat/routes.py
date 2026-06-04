from __future__ import annotations

import sys
from pathlib import Path
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
from app.core.config import Settings, get_settings


router = APIRouter(prefix="/chat", tags=["chat"])


def get_chat_repository(
    settings: Annotated[Settings, Depends(get_settings)],
) -> ChatRepository:
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseChatRepository(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return chat_repository


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


@router.post("/query", response_model=ChatQueryResponse)
def query_chat(
    payload: ChatQueryRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    retriever: Annotated[QdrantRetriever, Depends(get_retriever)],
    answer_generator: Annotated[AnswerGenerator, Depends(get_answer_generator)],
) -> ChatQueryResponse:
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
    retriever: Annotated[QdrantRetriever, Depends(get_retriever)],
    answer_generator: Annotated[AnswerGenerator, Depends(get_answer_generator)],
) -> ChatSessionMessageResponse:
    if not repository.get_session(current_user.id, session_id):
        raise HTTPException(status_code=403, detail="chat session is not accessible")

    repository.create_message(
        current_user.id,
        session_id,
        "user",
        payload.question,
    )
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
    return ChatSessionMessageResponse(
        session_id=session_id,
        answer=chat_response.answer,
        citations=chat_response.citations,
    )
