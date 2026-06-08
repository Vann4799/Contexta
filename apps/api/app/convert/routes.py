from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Annotated, Callable, Protocol

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.documents.routes import MAX_UPLOAD_BYTES, read_upload_content, safe_upload_filename


router = APIRouter(prefix="/convert", tags=["convert"])
PDF_CONTENT_TYPES = {"application/pdf"}


class MarkdownConversionResult(BaseModel):
    filename: str
    markdown: str
    size_bytes: int
    output_filename: str


class MarkdownConverter(Protocol):
    def convert(self, path: str):
        ...


def create_markdown_converter() -> MarkdownConverter:
    try:
        from markitdown import MarkItDown
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Markdown conversion service is unavailable.",
        ) from exc

    return MarkItDown()


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

    temp_path = ""
    try:
        converter = converter_factory()
        with NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name

        result = converter.convert(temp_path)
        markdown = result.text_content
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to convert PDF to Markdown.",
        ) from exc
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)

    return MarkdownConversionResult(
        filename=filename,
        markdown=markdown,
        size_bytes=len(content),
        output_filename=markdown_output_filename(filename),
    )
