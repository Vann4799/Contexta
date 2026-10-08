import logging
import re
from collections import Counter
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.chat.llm import AnswerGenerator, DeepSeekAnswerGenerator
from app.core.config import Settings, get_settings
from app.documents.models import (
    DEFAULT_CHUNK_PAGE_SIZE,
    MAX_CHUNK_PAGE_SIZE,
    CHUNK_PREVIEW_MAX_CHARS,
    DocumentAIBriefResponse,
    DocumentChunkResponse,
    DocumentChunksPage,
    DocumentChunkRow,
    DocumentCreate,
    DocumentIntelligenceResponse,
    DocumentMetadataUpdate,
    DocumentResponse,
    DocumentType,
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
logger = logging.getLogger(__name__)
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
_PAYLOAD_SYNCED_FIELDS = frozenset({"doc_type", "doc_version"})


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
        api_key=settings.qdrant_api_key,
    )


def get_document_answer_generator(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AnswerGenerator:
    return DeepSeekAnswerGenerator(
        api_key=settings.deepseek_api_key,
        model=settings.deepseek_model,
        max_tokens=settings.deepseek_max_tokens,
        thinking=settings.deepseek_thinking,
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
        "Buat brief bisnis yang rapi, lengkap, dan sangat ringkas dalam Bahasa Indonesia berdasarkan konteks dokumen saja.\n"
        "Wajib selesaikan semua bagian, jangan berhenti di tengah kalimat, dan akhiri jawaban dengan kalimat 'Brief selesai.'\n"
        "Target panjang 350-500 kata agar jawaban selesai tanpa terpotong.\n"
        "Format jawaban:\n"
        "1. Ringkasan singkat: 1 paragraf maksimal 5 kalimat.\n"
        "2. Insight utama: 4 bullet pendek.\n"
        "3. Pola yang terlihat: 3 bullet pendek.\n"
        "4. Rekomendasi pertanyaan lanjutan: 3 pertanyaan pendek saja.\n"
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


def chunk_row(chunk: DocumentChunkResponse) -> DocumentChunkRow:
    collapsed = " ".join(chunk.text.split())
    return DocumentChunkRow(
        chunk_index=chunk.chunk_index,
        page_number=chunk.page_number,
        section_path=chunk.section_path,
        is_table=chunk.is_table,
        char_count=len(chunk.text),
        token_count=chunk.token_count,
        preview=collapsed[:CHUNK_PREVIEW_MAX_CHARS],
    )


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


@router.get("/{document_id}/chunks", response_model=DocumentChunksPage)
def get_document_chunks(
    document_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_CHUNK_PAGE_SIZE)] = DEFAULT_CHUNK_PAGE_SIZE,
) -> DocumentChunksPage:
    document = repository.get_document(current_user.id, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="document not found")

    chunks, total = repository.chunk_page(current_user.id, document_id, page, page_size)
    return DocumentChunksPage(
        document_id=document.id,
        total=total,
        page=page,
        page_size=page_size,
        items=[chunk_row(chunk) for chunk in chunks],
    )


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
        logger.exception("could not generate a brief for document %s", document_id)
        raise HTTPException(
            status_code=502, detail="Unable to generate AI brief."
        ) from exc

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
    except Exception as exc:
        logger.exception("could not drop vectors for document %s", document_id)
        raise HTTPException(
            status_code=502,
            detail="Unable to remove the indexed chunks for this document.",
        ) from exc

    try:
        await storage.delete_document(document.storage_path)
    except Exception as exc:
        logger.exception("could not delete stored file for document %s", document_id)
        raise HTTPException(
            status_code=502,
            detail="Unable to remove the stored file for this document.",
        ) from exc

    try:
        repository.delete_document(current_user.id, document_id)
    except Exception as exc:
        logger.exception("could not delete document row %s", document_id)
        raise HTTPException(
            status_code=502,
            detail="Unable to delete this document.",
        ) from exc


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
    except Exception as exc:
        logger.exception("could not drop vectors before retrying document %s", document_id)
        raise HTTPException(
            status_code=502,
            detail="Unable to clear the previous indexing attempt for this document.",
        ) from exc

    try:
        retried_document = repository.retry_failed_document(current_user.id, document_id)
    except Exception as exc:
        logger.exception("could not queue document %s for retry", document_id)
        raise HTTPException(status_code=502, detail="Unable to retry this document.") from exc

    if not retried_document:
        raise HTTPException(status_code=404, detail="document not found")
    return retried_document


@router.post("/{document_id}/reindex", response_model=DocumentResponse)
def reindex_document(
    document_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
) -> DocumentResponse:
    document = repository.get_document(current_user.id, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="document not found")
    if document.status != "ready":
        raise HTTPException(
            status_code=409,
            detail="only ready documents can be re-indexed",
        )

    # No vector wipe: chunk point ids are derived from document_id + chunk_index, so the
    # worker's upsert overwrites them and its prune drops the leftovers. The old vectors
    # keep answering until the new pass lands.
    try:
        reindexed_document = repository.reindex_ready_document(current_user.id, document_id)
    except Exception as exc:
        logger.exception("could not queue document %s for re-index", document_id)
        raise HTTPException(status_code=502, detail="Unable to re-index this document.") from exc

    if not reindexed_document:
        raise HTTPException(status_code=404, detail="document not found")
    return reindexed_document


@router.patch("/{document_id}/metadata", response_model=DocumentResponse)
def update_document_metadata(
    document_id: str,
    metadata: DocumentMetadataUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
    vector_cleanup: Annotated[DocumentVectorCleanup, Depends(get_document_vector_cleanup)],
) -> DocumentResponse:
    document = repository.get_document(current_user.id, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="document not found")
    if document.status in {"uploaded", "processing"}:
        raise HTTPException(
            status_code=409,
            detail="document metadata cannot be edited while indexing is running",
        )

    changes = metadata.model_dump(exclude_unset=True)
    updated_document = repository.update_document_metadata(
        current_user.id,
        document_id,
        changes,
    )
    if not updated_document:
        raise HTTPException(status_code=404, detail="document not found")

    payload_changes = {
        key: value
        for key, value in changes.items()
        if key in _PAYLOAD_SYNCED_FIELDS
    }
    if payload_changes:
        try:
            vector_cleanup.set_document_payload(
                current_user.id,
                document_id,
                payload_changes,
            )
        except Exception as exc:
            logger.exception("could not sync metadata for document %s", document_id)
            raise HTTPException(
                status_code=502,
                detail="Document metadata was saved, but the search index is still stale.",
            ) from exc

    return updated_document


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
    doc_type: Annotated[DocumentType, Form()] = "unclassified",
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
        doc_type=doc_type,
    )

    await storage.upload_document(
        storage_path,
        content,
        file.content_type or "application/octet-stream",
    )
    return repository.create_document(current_user.id, document)
