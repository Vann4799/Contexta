from datetime import datetime, timezone
from typing import Protocol
from uuid import uuid4

from app.integrations.models import (
    IntegrationConnection,
    IntegrationDefinition,
    IntegrationProvider,
)


INTEGRATION_DEFINITIONS: list[IntegrationDefinition] = [
    IntegrationDefinition(
        provider="slack",
        name="Slack",
        description="Connect your Slack workspace to receive document notifications and search results directly in channels.",
        icon="slack",
        scopes=["channels:read", "chat:write", "files:read"],
        oauth_supported=True,
    ),
    IntegrationDefinition(
        provider="notion",
        name="Notion",
        description="Sync Notion pages and databases into Contexta for unified search and chat.",
        icon="notion",
        scopes=["pages:read", "databases:read"],
        oauth_supported=True,
    ),
    IntegrationDefinition(
        provider="google_drive",
        name="Google Drive",
        description="Index documents from Google Drive automatically and keep them in sync.",
        icon="google_drive",
        scopes=["drive.readonly", "docs.readonly"],
        oauth_supported=True,
    ),
    IntegrationDefinition(
        provider="github",
        name="GitHub",
        description="Connect repositories to index README files, issues, and documentation.",
        icon="github",
        scopes=["repo", "read:org"],
        oauth_supported=True,
    ),
]


class IntegrationRepository(Protocol):
    def list_connections(self, user_id: str) -> list[IntegrationConnection]: ...
    def get_connection(self, user_id: str, provider: IntegrationProvider) -> IntegrationConnection | None: ...
    def save_connection(self, connection: IntegrationConnection) -> IntegrationConnection: ...
    def delete_connection(self, user_id: str, provider: IntegrationProvider) -> bool: ...


class InMemoryIntegrationRepository:
    def __init__(self) -> None:
        self._connections: dict[str, IntegrationConnection] = {}

    def _key(self, user_id: str, provider: str) -> str:
        return f"{user_id}:{provider}"

    def list_connections(self, user_id: str) -> list[IntegrationConnection]:
        return [c for c in self._connections.values() if c.user_id == user_id]

    def get_connection(self, user_id: str, provider: IntegrationProvider) -> IntegrationConnection | None:
        return self._connections.get(self._key(user_id, provider))

    def save_connection(self, connection: IntegrationConnection) -> IntegrationConnection:
        self._connections[self._key(connection.user_id, connection.provider)] = connection
        return connection

    def delete_connection(self, user_id: str, provider: IntegrationProvider) -> bool:
        key = self._key(user_id, provider)
        if key in self._connections:
            del self._connections[key]
            return True
        return False


class SupabaseIntegrationRepository:
    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self._supabase_url = supabase_url.rstrip("/")
        self._service_role_key = service_role_key

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._service_role_key,
            "Authorization": f"Bearer {self._service_role_key}",
            "Content-Type": "application/json",
        }

    def list_connections(self, user_id: str) -> list[IntegrationConnection]:
        import httpx

        response = httpx.get(
            f"{self._supabase_url}/rest/v1/integration_connections",
            headers=self._headers,
            params={"user_id": f"eq.{user_id}"},
        )
        response.raise_for_status()
        return [IntegrationConnection.model_validate(row) for row in response.json()]

    def get_connection(self, user_id: str, provider: IntegrationProvider) -> IntegrationConnection | None:
        import httpx

        response = httpx.get(
            f"{self._supabase_url}/rest/v1/integration_connections",
            headers=self._headers,
            params={
                "user_id": f"eq.{user_id}",
                "provider": f"eq.{provider}",
                "limit": "1",
            },
        )
        response.raise_for_status()
        rows = response.json()
        if not rows:
            return None
        return IntegrationConnection.model_validate(rows[0])

    def save_connection(self, connection: IntegrationConnection) -> IntegrationConnection:
        import httpx

        data = connection.model_dump(mode="json")
        response = httpx.post(
            f"{self._supabase_url}/rest/v1/integration_connections",
            headers={**self._headers, "Prefer": "return=representation,resolution=merge-duplicates"},
            json=data,
            params={"on_conflict": "user_id,provider"},
        )
        response.raise_for_status()
        rows = response.json()
        return IntegrationConnection.model_validate(rows[0])

    def delete_connection(self, user_id: str, provider: IntegrationProvider) -> bool:
        import httpx

        response = httpx.delete(
            f"{self._supabase_url}/rest/v1/integration_connections",
            headers=self._headers,
            params={
                "user_id": f"eq.{user_id}",
                "provider": f"eq.{provider}",
            },
        )
        response.raise_for_status()
        return len(response.json()) > 0


integration_repository = InMemoryIntegrationRepository()


def connect_integration(
    user_id: str,
    provider: IntegrationProvider,
    repository: IntegrationRepository,
    oauth_code: str | None = None,
) -> IntegrationConnection:
    existing = repository.get_connection(user_id, provider)
    now = datetime.now(timezone.utc)

    external_name = f"{provider.capitalize()} user"
    external_email = f"user@{provider}.example"

    connection = IntegrationConnection(
        id=existing.id if existing else str(uuid4()),
        user_id=user_id,
        provider=provider,
        status="connected",
        external_user_id=f"{provider}_{user_id[:8]}",
        external_user_name=external_name,
        external_user_email=external_email,
        scopes=[d.scopes for d in INTEGRATION_DEFINITIONS if d.provider == provider][0],
        metadata={"oauth_code": oauth_code} if oauth_code else None,
        connected_at=existing.connected_at if existing else now,
        last_synced_at=now,
        error_message=None,
    )

    return repository.save_connection(connection)


def disconnect_integration(
    user_id: str,
    provider: IntegrationProvider,
    repository: IntegrationRepository,
) -> bool:
    return repository.delete_connection(user_id, provider)
