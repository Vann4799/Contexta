from datetime import datetime
from typing import Literal

from pydantic import BaseModel


IntegrationProvider = Literal["slack", "notion", "google_drive", "github"]
IntegrationStatus = Literal["connected", "disconnected", "error"]


class IntegrationDefinition(BaseModel):
    provider: IntegrationProvider
    name: str
    description: str
    icon: str
    scopes: list[str]
    oauth_supported: bool


class IntegrationConnection(BaseModel):
    id: str
    user_id: str
    provider: IntegrationProvider
    status: IntegrationStatus
    external_user_id: str | None
    external_user_name: str | None
    external_user_email: str | None
    scopes: list[str]
    metadata: dict | None
    connected_at: datetime | None
    last_synced_at: datetime | None
    error_message: str | None


class IntegrationConnectionInput(BaseModel):
    provider: IntegrationProvider
    oauth_code: str | None = None
    redirect_uri: str | None = None


class IntegrationListResponse(BaseModel):
    definitions: list[IntegrationDefinition]
    connections: list[IntegrationConnection]
