from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


DocumentFileType = Literal["pdf", "docx"]
DocumentStatus = Literal["uploaded", "processing", "ready", "failed"]
MAX_DOCUMENT_FILE_SIZE_BYTES = 50 * 1024 * 1024


def expected_extension(file_type: DocumentFileType) -> str:
    return f".{file_type}"


def contains_path_traversal(value: str) -> bool:
    return any(segment == ".." for segment in value.split("/"))


class DocumentCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    file_type: DocumentFileType
    file_size: int = Field(gt=0, le=MAX_DOCUMENT_FILE_SIZE_BYTES)
    storage_path: str = Field(min_length=1, max_length=1024)

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, filename: str) -> str:
        if "/" in filename or "\\" in filename or contains_path_traversal(filename):
            raise ValueError("filename must be a basename")
        return filename

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
    created_at: datetime
    updated_at: datetime


class DocumentChunkResponse(BaseModel):
    document_id: str
    user_id: str
    chunk_index: int
    text: str
    page_number: int | None
    qdrant_point_id: str


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
