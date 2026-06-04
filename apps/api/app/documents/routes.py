import re
from collections import Counter
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.chat.llm import AnswerGenerator, DeepSeekAnswerGenerator
from app.core.config import Settings, get_settings
from app.documents.models import (
    DocumentAIBriefResponse,
    DocumentChunkResponse,
    DocumentCreate,
    DocumentIntelligenceResponse,
    DocumentResponse,
)
from app.documents.repository import (
    DocumentRepository,
    SupabaseDocumentRepository,
    document_repository,
)
from app.documents.storage import DocumentStorage, SupabaseDocumentStorage
from app.documents.vector_cleanup import (
    DocumentVectorCleanup,
    QdrantDocumentVectorCleanup,
)


router = APIRouter(prefix="/documents", tags=["documents"])
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
ALLOWED_UPLOAD_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}
GENERIC_UPLOAD_CONTENT_TYPES = {"", "application/octet-stream"}
UPLOAD_READ_CHUNK_SIZE = 1024 * 1024
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
LINK_PATTERN = re.compile(r"https?://[^\s,)]+")
NAME_PATTERN = re.compile(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b")
MAX_AI_BRIEF_CONTEXT_CHARS = 14000


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


def get_document_vector_cleanup(
    settings: Annotated[Settings, Depends(get_settings)],
) -> DocumentVectorCleanup:
    return QdrantDocumentVectorCleanup(
        qdrant_url=settings.qdrant_url,
        collection_name=settings.qdrant_collection,
    )


def get_document_answer_generator(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AnswerGenerator:
    return DeepSeekAnswerGenerator(
        api_key=settings.deepseek_api_key,
        model=settings.deepseek_model,
    )


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


def validate_document_storage_path(
    storage_path: str,
    user_id: str,
    filename: str,
) -> None:
    segments = storage_path.split("/")
    if len(segments) != 3:
        raise HTTPException(
            status_code=422,
            detail="storage_path must match <user_id>/<uuid>/<filename>",
        )
    if segments[0] != user_id:
        raise HTTPException(
            status_code=422,
            detail="storage_path must start with the authenticated user id",
        )
    try:
        UUID(segments[1])
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail="storage_path document id must be a UUID",
        ) from exc
    if segments[2] != filename:
        raise HTTPException(
            status_code=422,
            detail="storage_path filename must match document filename",
        )


def unique_in_order(values: list[str], limit: int = 12) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for value in values:
        normalized = value.strip().strip(".,;:)")
        if not normalized or normalized.lower() in seen:
            continue
        seen.add(normalized.lower())
        unique.append(normalized)
        if len(unique) >= limit:
            break
    return unique


def split_sentences(text: str) -> list[str]:
    return [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", text)
        if sentence.strip()
    ]


def build_document_intelligence(
    document: DocumentResponse,
    chunks: list[DocumentChunkResponse],
) -> DocumentIntelligenceResponse:
    combined_text = "\n".join(chunk.text for chunk in chunks)
    sentences = split_sentences(combined_text)
    key_points = [sentence[:260] for sentence in sentences[:5]]
    summary = " ".join(key_points[:3]) if key_points else "No processed text is available for this document yet."
    page_counts = Counter(
        chunk.page_number
        for chunk in chunks
        if chunk.page_number is not None
    )

    return DocumentIntelligenceResponse(
        document_id=document.id,
        filename=document.filename,
        status=document.status,
        chunk_count=len(chunks),
        summary=summary[:900],
        key_points=key_points,
        emails=unique_in_order(EMAIL_PATTERN.findall(combined_text)),
        links=unique_in_order(LINK_PATTERN.findall(combined_text)),
        candidate_names=unique_in_order(NAME_PATTERN.findall(combined_text)),
        top_pages=[page for page, _count in page_counts.most_common(5)],
        suggested_questions=[
            "Ringkas isi dokumen ini dalam 5 poin.",
            "Apa pola utama yang terlihat dari dokumen ini?",
            "Siapa saja nama atau pihak penting yang muncul?",
            "Apa insight yang bisa dipakai untuk keputusan bisnis?",
            "Buatkan report singkat berdasarkan dokumen ini.",
        ],
    )


def build_ai_brief_prompt(
    document: DocumentResponse,
    chunks: list[DocumentChunkResponse],
) -> str:
    context_parts: list[str] = []
    current_length = 0
    for chunk in chunks:
        page = f"page {chunk.page_number}" if chunk.page_number else "page unknown"
        part = f"[Chunk {chunk.chunk_index}, {page}]\n{chunk.text.strip()}"
        if current_length + len(part) > MAX_AI_BRIEF_CONTEXT_CHARS:
            break
        context_parts.append(part)
        current_length += len(part)

    context = "\n\n".join(context_parts)
    return (
        "Anda adalah analis dokumen untuk produk Contexta.\n"
        "Buat brief bisnis yang rapi dalam Bahasa Indonesia berdasarkan konteks dokumen saja.\n"
        "Format jawaban:\n"
        "1. Ringkasan singkat\n"
        "2. Insight utama\n"
        "3. Pola yang terlihat\n"
        "4. Rekomendasi pertanyaan lanjutan\n"
        "Jika konteks tidak cukup, jelaskan batasannya.\n\n"
        f"Nama dokumen: {document.filename}\n\n"
        f"Konteks dokumen:\n{context}"
    )


async def read_upload_content(file: UploadFile) -> bytes:
    content = bytearray()
    while chunk := await file.read(UPLOAD_READ_CHUNK_SIZE):
        content.extend(chunk)
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=422, detail="uploaded file is too large")
    return bytes(content)


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
) -> list[DocumentResponse]:
    return repository.list_documents(current_user.id)


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
) -> DocumentResponse:
    document = repository.get_document(current_user.id, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="document not found")
    return document


@router.get("/{document_id}/intelligence", response_model=DocumentIntelligenceResponse)
def get_document_intelligence(
    document_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
) -> DocumentIntelligenceResponse:
    document = repository.get_document(current_user.id, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="document not found")

    chunks = repository.list_document_chunks(current_user.id, document_id)
    return build_document_intelligence(document, chunks)


@router.post("/{document_id}/brief", response_model=DocumentAIBriefResponse)
def generate_document_ai_brief(
    document_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
    answer_generator: Annotated[AnswerGenerator, Depends(get_document_answer_generator)],
) -> DocumentAIBriefResponse:
    document = repository.get_document(current_user.id, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="document not found")

    chunks = repository.list_document_chunks(current_user.id, document_id)
    if not chunks:
        raise HTTPException(status_code=422, detail="document has no processed chunks")

    try:
        brief = answer_generator.generate_answer(build_ai_brief_prompt(document, chunks))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return DocumentAIBriefResponse(document_id=document.id, brief=brief)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    storage: Annotated[DocumentStorage, Depends(get_document_storage)],
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
    vector_cleanup: Annotated[DocumentVectorCleanup, Depends(get_document_vector_cleanup)],
) -> None:
    document = repository.get_document(current_user.id, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="document not found")

    try:
        vector_cleanup.delete_document_vectors(current_user.id, document_id)
        await storage.delete_document(document.storage_path)
        repository.delete_document(current_user.id, document_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Unable to delete document.") from exc


@router.post("/{document_id}/retry", response_model=DocumentResponse)
def retry_document_processing(
    document_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
    vector_cleanup: Annotated[DocumentVectorCleanup, Depends(get_document_vector_cleanup)],
) -> DocumentResponse:
    document = repository.get_document(current_user.id, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="document not found")
    if document.status != "failed":
        raise HTTPException(
            status_code=409,
            detail="only failed documents can be retried",
        )

    try:
        vector_cleanup.delete_document_vectors(current_user.id, document_id)
        retried_document = repository.retry_failed_document(current_user.id, document_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Unable to retry document.") from exc

    if not retried_document:
        raise HTTPException(status_code=404, detail="document not found")
    return retried_document


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
    validate_document_storage_path(
        document.storage_path,
        current_user.id,
        document.filename,
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
    content = await read_upload_content(file)

    if not content:
        raise HTTPException(status_code=422, detail="uploaded file must not be empty")

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
