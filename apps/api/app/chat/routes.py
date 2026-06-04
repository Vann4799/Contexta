from __future__ import annotations

import sys
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

try:
    from contexta_rag.prompts import build_rag_prompt
except ModuleNotFoundError:
    rag_package_path = Path(__file__).resolve().parents[4] / "packages" / "rag"
    sys.path.append(str(rag_package_path))
    from contexta_rag.prompts import build_rag_prompt

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.chat.llm import AnswerGenerator, DeepSeekAnswerGenerator
from app.chat.models import ChatCitation, ChatQueryRequest, ChatQueryResponse
from app.chat.retrieval import DeterministicEmbeddingProvider, QdrantRetriever
from app.core.config import Settings, get_settings


router = APIRouter(prefix="/chat", tags=["chat"])


def get_retriever(
    settings: Annotated[Settings, Depends(get_settings)],
) -> QdrantRetriever:
    return QdrantRetriever(
        qdrant_url=settings.qdrant_url,
        collection_name=settings.qdrant_collection,
        embedding_provider=DeterministicEmbeddingProvider(
            dimensions=settings.embedding_dimensions
        ),
    )


def get_answer_generator(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AnswerGenerator:
    return DeepSeekAnswerGenerator(
        api_key=settings.deepseek_api_key,
        model=settings.deepseek_model,
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

    return ChatQueryResponse(
        answer=answer,
        citations=[
            ChatCitation(
                source_number=index,
                document_id=context["document_id"],
                document_name=context["document_name"],
                chunk_index=context["chunk_index"],
                page_number=context["page_number"],
                text=context["text"],
                score=context["score"],
            )
            for index, context in enumerate(contexts, start=1)
        ],
    )
