from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.apikeys.dependencies import get_api_key_repository
from app.apikeys.models import (
    ALLOWED_SCOPES,
    ApiKeyCreate,
    ApiKeyCreatedResponse,
    ApiKeyResponse,
    ApiKeyUsageResponse,
)
from app.apikeys.repository import ApiKeyRepository
from app.apikeys.secrets import generate_api_key
from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.documents.repository import DocumentRepository
from app.documents.routes import get_document_repository


router = APIRouter(prefix="/api-keys", tags=["api-keys"])
MAX_KEYS_PER_USER = 10


def _as_response(row: dict[str, object]) -> ApiKeyResponse:
    return ApiKeyResponse.model_validate(row)


@router.get("", response_model=list[ApiKeyResponse])
def list_api_keys(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[ApiKeyRepository, Depends(get_api_key_repository)],
) -> list[ApiKeyResponse]:
    return [_as_response(row) for row in repository.list_keys(current_user.id)]


@router.post(
    "",
    response_model=ApiKeyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_api_key(
    payload: ApiKeyCreate,
    response: Response,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[ApiKeyRepository, Depends(get_api_key_repository)],
    documents: Annotated[DocumentRepository, Depends(get_document_repository)],
) -> ApiKeyCreatedResponse:
    existing = repository.list_keys(current_user.id)
    if len(existing) >= MAX_KEYS_PER_USER:
        raise HTTPException(
            status_code=409,
            detail=f"a workspace can hold at most {MAX_KEYS_PER_USER} API keys",
        )

    for document_id in payload.document_ids:
        if documents.get_document(current_user.id, document_id) is None:
            # Rejected rather than silently dropped: a key created from a typo'd id would
            # look like a subset key while actually returning nothing forever.
            raise HTTPException(
                status_code=422,
                detail="document_ids must reference documents in this workspace",
            )

    plaintext, key_hash, key_prefix, last_four = generate_api_key()
    row = repository.create_key(
        user_id=current_user.id,
        name=payload.name,
        # The plaintext exists only in this local and the response body; the row keeps
        # the digest and the two display fragments.
        key_hash=key_hash,
        key_prefix=key_prefix,
        last_four=last_four,
        document_ids=payload.document_ids,
        scopes=list(ALLOWED_SCOPES),
        expires_at=payload.expires_at,
    )

    response.headers["Location"] = f"/api-keys/{row['id']}"
    response.headers["Cache-Control"] = "no-store"
    return ApiKeyCreatedResponse(
        **_as_response(row).model_dump(),
        api_key=plaintext,
    )


@router.post("/{key_id}/revoke", response_model=ApiKeyResponse)
def revoke_api_key(
    key_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[ApiKeyRepository, Depends(get_api_key_repository)],
) -> ApiKeyResponse:
    revoked = repository.revoke_key(current_user.id, key_id)
    if revoked is None:
        raise HTTPException(status_code=404, detail="api key not found")
    return _as_response(revoked)


@router.get("/{key_id}/usage", response_model=ApiKeyUsageResponse)
def api_key_usage(
    key_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[ApiKeyRepository, Depends(get_api_key_repository)],
    days: Annotated[int, Query(ge=1, le=90)] = 14,
) -> ApiKeyUsageResponse:
    if repository.get_key(current_user.id, key_id) is None:
        raise HTTPException(status_code=404, detail="api key not found")
    return ApiKeyUsageResponse.model_validate(repository.usage(current_user.id, key_id, days))
