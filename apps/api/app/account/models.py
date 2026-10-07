from pydantic import BaseModel, Field

from app.documents.models import DocumentType


class AccountStatusCounts(BaseModel):
    """Required, with no defaults: a status the RPC stopped reporting has to fail loudly."""

    uploaded: int = Field(ge=0)
    processing: int = Field(ge=0)
    ready: int = Field(ge=0)
    failed: int = Field(ge=0)


class AccountDocumentSummary(BaseModel):
    total: int = Field(ge=0)
    by_status: AccountStatusCounts


class AccountTopDocType(BaseModel):
    doc_type: DocumentType
    documents: int = Field(ge=1)


class AccountActivity(BaseModel):
    uploads_7d: int = Field(ge=0)
    indexed_7d: int = Field(ge=0)
    chats_7d: int = Field(ge=0)
    last_upload_at: str | None = None
    last_index_at: str | None = None
    last_chat_at: str | None = None


class AccountDeveloperSummary(BaseModel):
    api_keys_active: int = Field(ge=0)
    api_requests_14d: int = Field(ge=0)


class AccountSummaryResponse(BaseModel):
    documents: AccountDocumentSummary
    chunks: int = Field(ge=0)
    storage_bytes: int = Field(ge=0)
    top_doc_type: AccountTopDocType | None
    sessions: int = Field(ge=0)
    activity: AccountActivity
    developer: AccountDeveloperSummary
