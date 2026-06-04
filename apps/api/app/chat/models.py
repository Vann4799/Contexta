from __future__ import annotations

from pydantic import BaseModel, Field
from typing import TypedDict


class ChatQueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    document_ids: list[str] | None = None


class RetrievedContext(TypedDict):
    document_id: str
    document_name: str
    chunk_index: int
    page_number: int | None
    text: str
    score: float


class ChatCitation(BaseModel):
    source_number: int
    document_id: str
    document_name: str
    chunk_index: int
    page_number: int | None
    text: str
    score: float


class ChatQueryResponse(BaseModel):
    answer: str
    citations: list[ChatCitation]
