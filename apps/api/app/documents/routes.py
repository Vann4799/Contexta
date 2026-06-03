from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.documents.models import DocumentCreate, DocumentResponse
from app.documents.repository import DocumentRepository, document_repository


router = APIRouter(prefix="/documents", tags=["documents"])


def get_document_repository() -> DocumentRepository:
    return document_repository


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
) -> list[DocumentResponse]:
    return repository.list_documents(current_user.id)


@router.post(
    "",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_document(
    document: DocumentCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
) -> DocumentResponse:
    if not document.storage_path.startswith(f"{current_user.id}/"):
        raise HTTPException(
            status_code=422,
            detail="storage_path must start with the authenticated user id",
        )
    return repository.create_document(current_user.id, document)
