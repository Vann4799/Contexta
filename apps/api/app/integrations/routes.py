from typing import Annotated
from uuid import uuid4
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.core.config import Settings, get_settings
from app.integrations.models import (
    IntegrationConnection,
    IntegrationConnectionInput,
    IntegrationListResponse,
    IntegrationProvider,
)
from app.integrations.oauth import (
    build_authorize_url,
    exchange_code_for_token,
    extract_access_token,
    fetch_user_profile,
    verify_state,
)
from app.integrations.repository import (
    INTEGRATION_DEFINITIONS,
    IntegrationRepository,
    SupabaseIntegrationRepository,
    connect_integration,
    disconnect_integration,
    integration_repository,
)


router = APIRouter(prefix="/integrations", tags=["integrations"])


def get_integration_repo(
    settings: Annotated[Settings, Depends(get_settings)],
) -> IntegrationRepository:
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseIntegrationRepository(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return integration_repository


@router.get("", response_model=IntegrationListResponse)
def list_integrations(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[IntegrationRepository, Depends(get_integration_repo)],
) -> IntegrationListResponse:
    connections = repository.list_connections(current_user.id)
    return IntegrationListResponse(
        definitions=INTEGRATION_DEFINITIONS,
        connections=connections,
    )


@router.get("/{provider}/authorize")
def authorize(
    provider: IntegrationProvider,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, str]:
    client_id, _ = settings.oauth_credentials(provider)
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"OAuth is not configured for {provider}.",
        )
    redirect_uri = settings.oauth_callback_url
    url = build_authorize_url(
        provider, client_id, redirect_uri, current_user.id, settings.supabase_jwt_secret
    )
    return {"authorize_url": url}


@router.get("/callback", response_class=HTMLResponse)
async def oauth_callback(
    code: str,
    state: str,
    settings: Annotated[Settings, Depends(get_settings)],
    repository: Annotated[IntegrationRepository, Depends(get_integration_repo)],
) -> HTMLResponse:
    result = verify_state(state, settings.supabase_jwt_secret)
    if not result:
        return _callback_redirect(settings, "error=invalid_state")

    user_id, provider = result
    provider_typed: IntegrationProvider = provider  # type: ignore[assignment]

    client_id, client_secret = settings.oauth_credentials(provider_typed)
    if not client_id or not client_secret:
        return _callback_redirect(settings, "error=not_configured")

    redirect_uri = settings.oauth_callback_url

    try:
        token_data = await exchange_code_for_token(
            provider_typed, code, client_id, client_secret, redirect_uri
        )
        access_token = extract_access_token(provider_typed, token_data)
        if not access_token:
            return _callback_redirect(settings, "error=token_failed")

        ext_id, ext_name, ext_email = await fetch_user_profile(
            provider_typed, access_token, token_data
        )
    except Exception:
        return _callback_redirect(settings, "error=exchange_failed")

    _save_connection(user_id, provider_typed, ext_id, ext_name, ext_email, repository)
    return _callback_redirect(settings, "success=true")


def _save_connection(
    user_id: str,
    provider: IntegrationProvider,
    ext_id: str,
    ext_name: str | None,
    ext_email: str | None,
    repository: IntegrationRepository,
) -> IntegrationConnection:
    existing = repository.get_connection(user_id, provider)
    now = datetime.now(timezone.utc)
    definition = next((d for d in INTEGRATION_DEFINITIONS if d.provider == provider), None)
    connection = IntegrationConnection(
        id=existing.id if existing else str(uuid4()),
        user_id=user_id,
        provider=provider,
        status="connected",
        external_user_id=ext_id,
        external_user_name=ext_name,
        external_user_email=ext_email,
        scopes=definition.scopes if definition else [],
        metadata=None,
        connected_at=existing.connected_at if existing else now,
        last_synced_at=now,
        error_message=None,
    )
    return repository.save_connection(connection)


def _callback_redirect(settings: Settings, query: str) -> HTMLResponse:
    url = f"{settings.app_base_url}/integrations?{query}"
    return HTMLResponse(
        content=(
            f'<!DOCTYPE html><html><head>'
            f'<meta http-equiv="refresh" content="0;url={url}">'
            f"</head><body>Redirecting...</body></html>"
        ),
        status_code=200,
    )


@router.post("/connect", response_model=IntegrationConnection)
def connect(
    body: IntegrationConnectionInput,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[IntegrationRepository, Depends(get_integration_repo)],
) -> IntegrationConnection:
    return connect_integration(
        current_user.id,
        body.provider,
        repository,
        oauth_code=body.oauth_code,
    )


@router.delete("/{provider}/disconnect", status_code=status.HTTP_204_NO_CONTENT)
def disconnect(
    provider: IntegrationProvider,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[IntegrationRepository, Depends(get_integration_repo)],
) -> None:
    deleted = disconnect_integration(current_user.id, provider, repository)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration connection not found.",
        )
