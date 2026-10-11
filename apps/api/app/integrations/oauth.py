import hashlib
import hmac
import time
from typing import Any

import httpx

from app.integrations.models import IntegrationProvider


_AUTHORIZE_URLS: dict[IntegrationProvider, str] = {
    "github": "https://github.com/login/oauth/authorize",
    "slack": "https://slack.com/oauth/v2/authorize",
    "notion": "https://api.notion.com/v1/oauth/authorize",
    "google_drive": "https://accounts.google.com/o/oauth2/v2/auth",
}

_TOKEN_URLS: dict[IntegrationProvider, str] = {
    "github": "https://github.com/login/oauth/access_token",
    "slack": "https://slack.com/api/oauth.v2.access",
    "notion": "https://api.notion.com/v1/oauth/token",
    "google_drive": "https://oauth2.googleapis.com/token",
}

_USER_INFO_URLS: dict[IntegrationProvider, str] = {
    "github": "https://api.github.com/user",
    "slack": "https://slack.com/api/users.identity",
    "notion": "",
    "google_drive": "https://www.googleapis.com/oauth2/v2/userinfo",
}

_DEFAULT_SCOPES: dict[IntegrationProvider, str] = {
    "github": "repo read:org",
    "slack": "users:read,channels:read,chat:write,files:read",
    "notion": "",
    "google_drive": "openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/documents.readonly",
}

_SCOPE_PARAM: dict[IntegrationProvider, str] = {
    "github": "scope",
    "slack": "scopes",
    "notion": "",
    "google_drive": "scope",
}

_TOKEN_FORM_ENCODED = {"github"}

STATE_TTL_SECONDS = 600
_STATE_SECRET_FALLBACK = "contexta-oauth-state"


def _state_secret(settings_secret: str) -> bytes:
    return (settings_secret or _STATE_SECRET_FALLBACK).encode()


def sign_state(user_id: str, provider: str, settings_secret: str) -> str:
    payload = f"{user_id}:{int(time.time())}:{provider}"
    sig = hmac.new(_state_secret(settings_secret), payload.encode(), hashlib.sha256).hexdigest()[:16]
    return f"{payload}:{sig}"


def verify_state(state: str, settings_secret: str) -> tuple[str, str] | None:
    """Returns (user_id, provider) or None if invalid/expired."""
    parts = state.split(":")
    if len(parts) != 4:
        return None
    user_id, ts_str, provider, sig = parts
    expected = f"{user_id}:{ts_str}:{provider}:{sig}"
    if not hmac.compare_digest(state, expected):
        return None
    try:
        ts = int(ts_str)
    except ValueError:
        return None
    if time.time() - ts > STATE_TTL_SECONDS:
        return None
    if provider not in ("github", "slack", "notion", "google_drive"):
        return None
    return (user_id, provider)


def build_authorize_url(
    provider: IntegrationProvider,
    client_id: str,
    redirect_uri: str,
    user_id: str,
    settings_secret: str,
) -> str:
    from urllib.parse import urlencode

    state = sign_state(user_id, provider, settings_secret)
    params: dict[str, str] = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "response_type": "code",
    }
    if provider == "google_drive":
        params["access_type"] = "online"
        params["prompt"] = "consent"

    scope_param = _SCOPE_PARAM.get(provider, "scope")
    scope_value = _DEFAULT_SCOPES.get(provider, "")
    if scope_param and scope_value:
        params[scope_param] = scope_value

    return f"{_AUTHORIZE_URLS[provider]}?{urlencode(params)}"


async def exchange_code_for_token(
    provider: IntegrationProvider,
    code: str,
    client_id: str,
    client_secret: str,
    redirect_uri: str,
) -> dict[str, Any]:
    data: dict[str, str] = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
    }
    if provider == "notion":
        data["grant_type"] = "authorization_code"

    headers: dict[str, str] = {"Accept": "application/json"}
    if provider == "notion":
        headers["Notion-Version"] = "2022-06-28"

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(_TOKEN_URLS[provider], data=data, headers=headers)

    if response.status_code >= 400:
        raise RuntimeError(
            f"Token exchange failed ({response.status_code}): {response.text[:200]}"
        )

    content_type = response.headers.get("content-type", "")
    if "json" in content_type:
        return response.json()

    from urllib.parse import parse_qs

    parsed = parse_qs(response.text)
    return {k: v[0] for k, v in parsed.items()}


def extract_access_token(provider: IntegrationProvider, token_data: dict[str, Any]) -> str:
    return token_data.get("access_token", "")


async def fetch_user_profile(
    provider: IntegrationProvider,
    access_token: str,
    token_data: dict[str, Any],
) -> tuple[str, str | None, str | None]:
    """Returns (external_user_id, display_name, email)."""
    if provider == "notion":
        workspace_name = token_data.get("workspace_name", "Notion Workspace")
        workspace_id = token_data.get("workspace_id", "unknown")
        return (workspace_id, workspace_name, None)

    if provider == "slack":
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                _USER_INFO_URLS["slack"],
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if response.ok:
            body = response.json()
            if body.get("ok"):
                user = body.get("user", {})
                team = body.get("team", {})
                uid = user.get("id", "unknown")
                name = user.get("name") or team.get("name") or uid
                return (uid, name, None)
        return ("slack_user", None, None)

    if provider == "github":
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                _USER_INFO_URLS["github"],
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json",
                },
            )
        if response.ok:
            data = response.json()
            uid = data.get("login", "unknown")
            name = data.get("name") or uid
            email = data.get("email")
            return (uid, name, email)
        return ("github_user", None, None)

    if provider == "google_drive":
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                _USER_INFO_URLS["google_drive"],
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if response.ok:
            data = response.json()
            return (
                data.get("email", "unknown"),
                data.get("name"),
                data.get("email"),
            )
        return ("google_user", None, None)

    return ("unknown", None, None)
