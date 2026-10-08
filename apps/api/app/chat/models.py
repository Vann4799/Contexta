from __future__ import annotations

from typing import TypedDict

from pydantic import BaseModel, Field


class ChatQueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    document_ids: list[str] | None = None


class RetrievedContext(TypedDict):
    document_id: str
    document_name: str
    doc_type: str
    chunk_index: int
    page_number: int | None
    section_path: str | None
    text: str
    score: float


class ChatCitation(BaseModel):
    source_number: int
    document_id: str
    document_name: str
    chunk_index: int
    page_number: int | None
    doc_type: str = "unclassified"
    section_path: str | None = None
    text: str
    score: float


class ChatQueryResponse(BaseModel):
    answer: str
    citations: list[ChatCitation]
    truncated: bool = False


class ChatSessionCreate(BaseModel):
    title: str = Field(default="New chat", min_length=1, max_length=120)


class ChatSessionResponse(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: str
    updated_at: str


class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    user_id: str
    role: str
    content: str
    citations: list[ChatCitation]
    metadata: dict[str, object]
    created_at: str


class ChatSessionMessageRequest(ChatQueryRequest):
    pass


class ChatSessionMessageResponse(ChatQueryResponse):
    session_id: str
