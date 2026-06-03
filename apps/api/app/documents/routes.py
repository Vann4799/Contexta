from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.core.config import Settings, get_settings
from app.documents.models import DocumentCreate, DocumentResponse
from app.documents.repository import (
    DocumentRepository,
    SupabaseDocumentRepository,
    document_repository,
)
from app.documents.storage import DocumentStorage, SupabaseDocumentStorage


router = APIRouter(prefix="/documents", tags=["documents"])
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
ALLOWED_UPLOAD_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}
GENERIC_UPLOAD_CONTENT_TYPES = {"", "application/octet-stream"}


def safe_upload_filename(filename: str) -> str:
    if any(segment == ".." for segment in filename.replace("\\", "/").split("/")):
        raise HTTPException(status_code=422, detail="filename must be a safe basename")

    basename = filename.replace("\\", "/").split("/")[-1].strip()
    if basename in {"", ".", ".."}:
        raise HTTPException(status_code=422, detail="filename must be a safe basename")

    return basename


def get_document_storage(
    settings: Annotated[Settings, Depends(get_settings)],
) -> DocumentStorage:
    return SupabaseDocumentStorage(
        settings.supabase_url,
        settings.supabase_service_role_key,
        settings.supabase_storage_bucket,
    )


def get_document_repository(
    settings: Annotated[Settings, Depends(get_settings)],
) -> DocumentRepository:
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseDocumentRepository(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return document_repository


def infer_upload_file_type(filename: str, content_type: str | None) -> str:
    if content_type in ALLOWED_UPLOAD_TYPES:
        return ALLOWED_UPLOAD_TYPES[content_type]

    if content_type and content_type not in GENERIC_UPLOAD_CONTENT_TYPES:
        raise HTTPException(status_code=422, detail="unsupported upload content type")

    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension in {"pdf", "docx"}:
        return extension

    raise HTTPException(status_code=422, detail="unsupported upload file type")


def validate_upload_filename_extension(filename: str, file_type: str) -> None:
    expected_extension = f".{file_type}"
    if not filename.lower().endswith(expected_extension):
        raise HTTPException(
            status_code=422,
            detail="filename extension must match upload content type",
        )


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


@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    storage: Annotated[DocumentStorage, Depends(get_document_storage)],
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
    file: Annotated[UploadFile, File(...)],
) -> DocumentResponse:
    filename = safe_upload_filename(file.filename or "")
    file_type = infer_upload_file_type(filename, file.content_type)
    validate_upload_filename_extension(filename, file_type)
    content = await file.read()

    if not content:
        raise HTTPException(status_code=422, detail="uploaded file must not be empty")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=422, detail="uploaded file is too large")

    document_id = str(uuid4())
    storage_path = f"{current_user.id}/{document_id}/{filename}"
    document = DocumentCreate(
        filename=filename,
        file_type=file_type,
        file_size=len(content),
        storage_path=storage_path,
    )

    await storage.upload_document(
        storage_path,
        content,
        file.content_type or "application/octet-stream",
    )
    return repository.create_document(current_user.id, document)
