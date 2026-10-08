from __future__ import annotations

import uuid

import httpx
import pytest
from fastapi.testclient import TestClient

import app.apikeys.repository as apikeys_repository_module
import app.chat.repository as chat_repository_module
import app.documents.repository as document_repository_module
from app.apikeys.repository import SupabaseApiKeyRepository
from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.chat.repository import SupabaseChatRepository
from app.core.config import Settings, get_settings
from app.core.ids import is_uuid
from app.documents.repository import SupabaseDocumentRepository
from app.main import app

# Supabase hands out uuid auth subject ids, so the test user has one too: a non-uuid
# user_id would itself be rejected by PostgREST on the `user_id=eq.` half of every
# filter, which would hide the behaviour under test.
USER_ID = "09f59060-e9a9-47d1-8b45-ba1d253d0957"
ABSENT_DOCUMENT_ID = "22222222-2222-4222-8222-222222222222"
ABSENT_SESSION_ID = "44444444-4444-4444-8444-444444444444"
ABSENT_KEY_ID = "33333333-3333-4333-8333-333333333333"
MALFORMED_ID = "not-a-uuid"

client = TestClient(app)

REPOSITORIES = (
    document_repository_module,
    chat_repository_module,
    apikeys_repository_module,
)


class PostgREST:
    """Stands in for httpx and answers the way PostgREST really does.

    Every id column in this schema is a Postgres `uuid`, so a filter that puts a
    non-uuid there is not a lookup that returns no rows: PostgREST refuses to build
    the query and answers HTTP 400 / SQLSTATE 22P02. Repository code calls
    `raise_for_status()`, so that 400 escaped as a 500. A double that only models the
    empty-list answer cannot express this, which is how the bug survived review.
    """

    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    @property
    def call_count(self) -> int:
        return len(self.calls)

    def _respond(self, method: str, url: str, **kwargs) -> httpx.Response:
        self.calls.append((method, url))

        filters: dict[str, str] = {}
        for key, value in (kwargs.get("params") or {}).items():
            if isinstance(value, str) and value.startswith("eq."):
                filters[key] = value[len("eq.") :]
        body = kwargs.get("json")
        if isinstance(body, dict):
            filters.update(
                {
                    f"p_{key}": value
                    for key, value in body.items()
                    if key.endswith("_id") and isinstance(value, str)
                }
            )

        for key, value in filters.items():
            if key.endswith("id") and not is_uuid(value):
                message = f'invalid input syntax for type uuid: "{value}"'
                return httpx.Response(
                    status_code=400,
                    request=httpx.Request(method, url),
                    json={
                        "error": message,
                        "message": message,
                        "code": "22P02",
                        "hint": None,
                        "detail": None,
                    },
                )

        return httpx.Response(
            status_code=200, request=httpx.Request(method, url), json=[]
        )

    def get(self, url: str, **kwargs) -> httpx.Response:
        return self._respond("GET", url, **kwargs)

    def post(self, url: str, **kwargs) -> httpx.Response:
        return self._respond("POST", url, **kwargs)

    def patch(self, url: str, **kwargs) -> httpx.Response:
        return self._respond("PATCH", url, **kwargs)

    def delete(self, url: str, **kwargs) -> httpx.Response:
        return self._respond("DELETE", url, **kwargs)


def _settings() -> Settings:
    return Settings(
        supabase_url="https://supabase.test",
        supabase_service_role_key="service-role",
    )


def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-token"}


@pytest.fixture
def postgrest(monkeypatch: pytest.MonkeyPatch) -> PostgREST:
    """Point every repository module at the double and use the real repositories."""
    fake = PostgREST()
    for module in REPOSITORIES:
        monkeypatch.setattr(module, "httpx", fake)
    app.dependency_overrides[get_settings] = _settings
    # A configured SUPABASE_URL makes Settings derive a JWKS URL, so the signed-in
    # user is injected rather than parsed from a test-secret token.
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=USER_ID,
        email="user@example.com",
        role="authenticated",
    )
    yield fake
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "value",
    ["", "1", "not-a-uuid", "00000000-0000-4000-8000-00000000000", str(uuid.uuid4()) + "g"],
)
def test_is_uuid_rejects_what_postgres_would_refuse(value: str) -> None:
    assert is_uuid(value) is False


@pytest.mark.parametrize("value", [str(uuid.uuid4()), uuid.uuid4().hex.upper()])
def test_is_uuid_accepts_every_form_postgres_parses(value: str) -> None:
    assert is_uuid(value) is True


def test_double_rejects_a_non_uuid_filter_the_way_postgrest_does() -> None:
    fake = PostgREST()
    response = fake.get(
        "https://supabase.test/rest/v1/documents",
        params={"id": f"eq.{MALFORMED_ID}"},
    )

    assert response.status_code == 400
    assert response.json()["code"] == "22P02"
    with pytest.raises(httpx.HTTPStatusError):
        response.raise_for_status()


def test_documents_repository_short_circuits_malformed_ids(postgrest: PostgREST) -> None:
    repository = SupabaseDocumentRepository("https://supabase.test", "service-role")

    assert repository.get_document(USER_ID, MALFORMED_ID) is None
    assert repository.list_document_chunks(USER_ID, MALFORMED_ID) == []
    assert repository.delete_document(USER_ID, MALFORMED_ID) is None
    assert repository.retry_failed_document(USER_ID, MALFORMED_ID) is None
    assert repository.reindex_ready_document(USER_ID, MALFORMED_ID) is None
    assert repository.update_document_metadata(USER_ID, MALFORMED_ID, {"doc_type": "report"}) is None
    assert postgrest.call_count == 0


def test_documents_repository_still_queries_absent_uuids(postgrest: PostgREST) -> None:
    repository = SupabaseDocumentRepository("https://supabase.test", "service-role")

    assert repository.get_document(USER_ID, ABSENT_DOCUMENT_ID) is None
    assert repository.list_document_chunks(USER_ID, ABSENT_DOCUMENT_ID) == []
    assert postgrest.call_count == 2


def test_chat_repository_short_circuits_malformed_ids(postgrest: PostgREST) -> None:
    repository = SupabaseChatRepository("https://supabase.test", "service-role")

    assert repository.get_session(USER_ID, MALFORMED_ID) is None
    assert repository.list_messages(USER_ID, MALFORMED_ID) == []
    assert repository.get_session(USER_ID, ABSENT_SESSION_ID) is None
    assert postgrest.call_count == 1


def test_api_keys_repository_short_circuits_malformed_ids(postgrest: PostgREST) -> None:
    repository = SupabaseApiKeyRepository("https://supabase.test", "service-role")

    assert repository.get_key(USER_ID, MALFORMED_ID) is None
    assert repository.revoke_key(USER_ID, MALFORMED_ID) is None
    assert repository.get_key(USER_ID, ABSENT_KEY_ID) is None
    assert postgrest.call_count == 1


@pytest.mark.parametrize(
    ("method", "path", "expected", "json", "detail"),
    [
        ("get", f"/documents/{MALFORMED_ID}", 404, None, "document not found"),
        ("get", f"/documents/{MALFORMED_ID}/intelligence", 404, None, "document not found"),
        ("get", f"/documents/{MALFORMED_ID}/chunks", 404, None, "document not found"),
        ("post", f"/documents/{MALFORMED_ID}/brief", 404, None, "document not found"),
        ("delete", f"/documents/{MALFORMED_ID}", 404, None, "document not found"),
        ("post", f"/documents/{MALFORMED_ID}/retry", 404, None, "document not found"),
        ("post", f"/documents/{MALFORMED_ID}/reindex", 404, None, "document not found"),
        ("patch", f"/documents/{MALFORMED_ID}/metadata", 404, {"doc_type": "report"}, "document not found"),
        ("get", f"/documents/{MALFORMED_ID}/export?format=md", 404, None, "document not found"),
        ("get", f"/chat/sessions/{MALFORMED_ID}/messages", 403, None, "chat session is not accessible"),
        (
            "post",
            f"/chat/sessions/{MALFORMED_ID}/messages",
            403,
            {"question": "apa itu chacha?"},
            "chat session is not accessible",
        ),
        ("post", f"/api-keys/{MALFORMED_ID}/revoke", 404, None, "api key not found"),
        ("get", f"/api-keys/{MALFORMED_ID}/usage", 404, None, "api key not found"),
    ],
)
def test_id_endpoints_answer_not_found_instead_of_500(
    postgrest: PostgREST,
    method: str,
    path: str,
    expected: int,
    json: dict[str, object] | None,
    detail: str,
) -> None:
    response = client.request(method, path, json=json, headers=auth_headers())

    assert response.status_code == expected
    assert detail in response.text
    assert postgrest.call_count == 0


@pytest.mark.parametrize(
    ("method", "path", "json"),
    [
        ("get", f"/documents/{ABSENT_DOCUMENT_ID}", None),
        ("get", f"/documents/{ABSENT_DOCUMENT_ID}/chunks", None),
        ("get", f"/documents/{ABSENT_DOCUMENT_ID}/export?format=md", None),
        ("get", f"/chat/sessions/{ABSENT_SESSION_ID}/messages", None),
        ("get", f"/api-keys/{ABSENT_KEY_ID}/usage", None),
    ],
)
def test_absent_uuid_ids_take_the_normal_database_path(
    postgrest: PostgREST,
    method: str,
    path: str,
    json: dict[str, object] | None,
) -> None:
    """The guard must only stop impossible lookups, not real misses."""
    response = client.request(method, path, json=json, headers=auth_headers())

    assert response.status_code in {403, 404}
    assert postgrest.call_count >= 1
