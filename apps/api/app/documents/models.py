from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


DocumentFileType = Literal["pdf", "docx"]
DocumentStatus = Literal["uploaded", "processing", "ready", "failed"]


class DocumentCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    file_type: DocumentFileType
    file_size: int = Field(ge=0)
    storage_path: str = Field(min_length=1, max_length=1024)


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
