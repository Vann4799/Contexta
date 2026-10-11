from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.core.config import Settings, get_settings
from app.integrations.models import (
    IntegrationConnection,
    IntegrationConnectionInput,
    IntegrationDefinition,
    IntegrationListResponse,
    IntegrationProvider,
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
