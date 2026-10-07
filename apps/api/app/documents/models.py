from datetime import datetime
import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


DocumentFileType = Literal["pdf", "docx"]
DocumentStatus = Literal["uploaded", "processing", "ready", "failed"]
DocumentType = Literal[
    "unclassified",
    "sop",
    "policy",
    "contract",
    "report",
    "thesis",
    "reference",
    "other",
]
MAX_DOCUMENT_FILE_SIZE_BYTES = 50 * 1024 * 1024


def expected_extension(file_type: DocumentFileType) -> str:
    return f".{file_type}"


def contains_path_traversal(value: str) -> bool:
    return any(segment == ".." for segment in value.split("/"))


def normalize_blank(value: object) -> object:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value


def validate_http_url(source_url: str | None) -> str | None:
    if source_url is None:
        return None
    if not re.match(r"^https?://\S+$", source_url, flags=re.IGNORECASE):
        raise ValueError("source_url must be an http(s) URL")
    return source_url


class DocumentCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    file_type: DocumentFileType
    file_size: int = Field(gt=0, le=MAX_DOCUMENT_FILE_SIZE_BYTES)
    storage_path: str = Field(min_length=1, max_length=1024)
    doc_type: DocumentType = "unclassified"
    source_url: str | None = Field(default=None, max_length=2048)
    doc_version: str | None = Field(default=None, max_length=64)

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, filename: str) -> str:
        if "/" in filename or "\\" in filename or contains_path_traversal(filename):
            raise ValueError("filename must be a basename")
        return filename

    @field_validator("source_url", "doc_version", mode="before")
    @classmethod
    def blank_to_none(cls, value: object) -> object:
        return normalize_blank(value)

    @field_validator("source_url")
    @classmethod
    def source_url_must_be_http(cls, source_url: str | None) -> str | None:
        return validate_http_url(source_url)

    @field_validator("storage_path")
    @classmethod
    def validate_storage_path(cls, storage_path: str) -> str:
        if (
            storage_path.startswith("/")
            or "\\" in storage_path
            or "//" in storage_path
            or contains_path_traversal(storage_path)
        ):
            raise ValueError("storage_path must be a relative object path")
        return storage_path

    @model_validator(mode="after")
    def validate_extensions(self) -> "DocumentCreate":
        extension = expected_extension(self.file_type)
        if not self.filename.lower().endswith(extension):
            raise ValueError("filename extension must match file_type")
        if not self.storage_path.lower().endswith(extension):
            raise ValueError("storage_path extension must match file_type")
        return self


class DocumentMetadataUpdate(BaseModel):
    doc_type: DocumentType | None = None
    source_url: str | None = Field(default=None, max_length=2048)
    doc_version: str | None = Field(default=None, max_length=64)

    @field_validator("source_url", "doc_version", mode="before")
    @classmethod
    def blank_to_none(cls, value: object) -> object:
        return normalize_blank(value)

    @field_validator("source_url")
    @classmethod
    def source_url_must_be_http(cls, source_url: str | None) -> str | None:
        return validate_http_url(source_url)

    @model_validator(mode="after")
    def require_a_change(self) -> "DocumentMetadataUpdate":
        if not self.model_fields_set:
            raise ValueError("at least one metadata field must be provided")
        return self


class DocumentResponse(BaseModel):
    id: str
    user_id: str
    filename: str
    file_type: DocumentFileType
    file_size: int
    storage_path: str
    status: DocumentStatus
    error_message: str | None
    chunk_count: int
    doc_type: DocumentType = "unclassified"
    source_url: str | None = None
    doc_version: str | None = None
    indexed_at: datetime | None = None
    embedding_model: str | None = None
    embedding_dimensions: int | None = None
    chunker_version: str | None = None
    created_at: datetime
    updated_at: datetime


class DocumentChunkResponse(BaseModel):
    document_id: str
    user_id: str
    chunk_index: int
    text: str
    page_number: int | None
    section_path: str | None = None
    is_table: bool = False
    char_count: int | None = None
    token_count: int | None = None
    qdrant_point_id: str


CHUNK_PREVIEW_MAX_CHARS = 240
DEFAULT_CHUNK_PAGE_SIZE = 20
MAX_CHUNK_PAGE_SIZE = 50


class DocumentChunkRow(BaseModel):
    chunk_index: int
    page_number: int | None
    section_path: str | None = None
    is_table: bool = False
    char_count: int
    token_count: int | None = None
    preview: str


class DocumentChunksPage(BaseModel):
    document_id: str
    total: int
    page: int
    page_size: int
    items: list[DocumentChunkRow]


class DocumentIntelligenceResponse(BaseModel):
    document_id: str
    filename: str
    status: DocumentStatus
    chunk_count: int
    summary: str
    key_points: list[str]
    emails: list[str]
    links: list[str]
    candidate_names: list[str]
    top_pages: list[int]
    suggested_questions: list[str]


class DocumentAIBriefResponse(BaseModel):
    document_id: str
    brief: str
