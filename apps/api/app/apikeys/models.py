from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


# v1 ships one scope. Endpoints check it for real instead of pretending a richer scope
# list exists; adding a second name is only meaningful when something can be denied.
ApiKeyScope = Literal["retrieve"]
ALLOWED_SCOPES: tuple[ApiKeyScope, ...] = ("retrieve",)
MAX_KEY_DOCUMENT_IDS = 50
MAX_KEY_NAME_CHARS = 60

ApiKeyOutcome = Literal[
    "allowed",
    "quota_minute",
    "quota_day",
    "revoked",
    "expired",
    "invalid",
]


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=MAX_KEY_NAME_CHARS)
    document_ids: list[str] = Field(default_factory=list, max_length=MAX_KEY_DOCUMENT_IDS)
    expires_at: datetime | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, name: str) -> str:
        stripped = name.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped

    @field_validator("document_ids")
    @classmethod
    def unique_document_ids(cls, document_ids: list[str]) -> list[str]:
        if len(set(document_ids)) != len(document_ids):
            raise ValueError("document_ids must not contain duplicates")
        if any(not document_id.strip() for document_id in document_ids):
            raise ValueError("document_ids must not contain blank values")
        return document_ids

    @model_validator(mode="after")
    def reject_past_expiry(self) -> "ApiKeyCreate":
        if self.expires_at is not None and self.expires_at <= datetime.now(self.expires_at.tzinfo):
            raise ValueError("expires_at must be in the future")
        return self


class ApiKeyResponse(BaseModel):
    """Everything about a key except the secret, which is never stored."""

    id: str
    name: str
    key_prefix: str
    last_four: str
    document_ids: list[str]
    scopes: list[ApiKeyScope]
    revoked_at: datetime | None = None
    expires_at: datetime | None = None
    last_used_at: datetime | None = None
    created_at: datetime


class ApiKeyCreatedResponse(ApiKeyResponse):
    api_key: str


class KeyAuthorization(BaseModel):
    """The decision returned by the api_key_authorize RPC, one row per request."""

    key_id: str | None
    user_id: str | None
    document_ids: list[str]
    scopes: list[str]
    outcome: ApiKeyOutcome
    status_code: int
    remaining_minute: int
    remaining_day: int
    log_id: int | None


class ApiKeyUsageDay(BaseModel):
    date: str
    allowed: int
    rejected: int


class ApiKeyUsageResponse(BaseModel):
    key_id: str
    days: int
    total: int
    allowed: int
    rejected: int
    by_outcome: dict[str, int]
    by_day: list[ApiKeyUsageDay]
