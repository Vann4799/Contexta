import logging
from pathlib import Path
import sys
from typing import Annotated, Callable

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fitz import FileDataError
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.documents.routes import MAX_UPLOAD_BYTES, read_upload_content, safe_upload_filename

try:
    from contexta_rag.extraction import DocumentTextExtractor, to_markdown
except ModuleNotFoundError:
    rag_package_path = Path(__file__).resolve().parents[4] / "packages" / "rag"
    sys.path.append(str(rag_package_path))
    from contexta_rag.extraction import DocumentTextExtractor, to_markdown


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/convert", tags=["convert"])
PDF_CONTENT_TYPES = {"application/pdf"}


class MarkdownConversionResult(BaseModel):
    filename: str
    markdown: str
    size_bytes: int
    output_filename: str


MarkdownConverter = Callable[[bytes], str]


def create_markdown_converter() -> MarkdownConverter:
    """Convert with the same extractor that produced the index.

    MarkItDown was a second reader over the same PDF, so the markdown a user copied was
    not the text Contexta answered from. One reader makes them the same bytes in the
    same order - including the content-stream order PDFs are drawn in, which is left
    exactly as the indexer sees it.
    """
    extractor = DocumentTextExtractor()

    def convert(content: bytes) -> str:
        return to_markdown(extractor.extract(content, "pdf"))

    return convert


def get_markdown_converter_factory() -> Callable[[], MarkdownConverter]:
    return create_markdown_converter


def validate_pdf_upload(filename: str, content_type: str | None) -> None:
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="uploaded file must be a PDF")

    if content_type not in PDF_CONTENT_TYPES:
        raise HTTPException(status_code=422, detail="uploaded file must be a PDF")


def markdown_output_filename(filename: str) -> str:
    return f"{Path(filename).stem}.md"


@router.post("/markdown", response_model=MarkdownConversionResult)
async def convert_pdf_to_markdown(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    converter_factory: Annotated[
        Callable[[], MarkdownConverter],
        Depends(get_markdown_converter_factory),
    ],
    file: Annotated[UploadFile, File(...)],
) -> MarkdownConversionResult:
    filename = safe_upload_filename(file.filename or "")
    validate_pdf_upload(filename, file.content_type)
    content = await read_upload_content(file)

    if not content:
        raise HTTPException(status_code=422, detail="uploaded file must not be empty")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=422, detail="uploaded file is too large")

    try:
        markdown = converter_factory()(content)
    except HTTPException:
        raise
    except FileDataError as exc:
        # A broken file is bad input, not a server fault; EmptyFileError subclasses
        # FileDataError but the empty check above answers it first.
        raise HTTPException(
            status_code=422,
            detail="uploaded PDF could not be read",
        ) from exc
    except Exception as exc:
        logger.exception("could not convert %s to markdown", filename)
        raise HTTPException(
            status_code=500,
            detail="Unable to convert PDF to Markdown.",
        ) from exc

    if not markdown.strip():
        # Same verdict the worker reaches for these bytes: "No extractable text
        # found" — a scanned PDF converts to nothing and must not answer 200.
        raise HTTPException(
            status_code=422,
            detail="uploaded PDF contains no extractable text",
        )

    return MarkdownConversionResult(
        filename=filename,
        markdown=markdown,
        size_bytes=len(content),
        output_filename=markdown_output_filename(filename),
    )
