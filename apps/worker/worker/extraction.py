from __future__ import annotations

import statistics
from io import BytesIO

import fitz
from docx import Document
from docx.text.paragraph import Paragraph

from worker.processor import ExtractedDocument, ExtractedPage, UserVisibleError

_MAX_HEADING_WORDS = 12
_HEADING_LEVEL_ONE = 1.35
_HEADING_LEVEL_TWO = 1.15


class DocumentTextExtractor:
    def extract(self, content: bytes, file_type: str) -> ExtractedDocument:
        if file_type == "pdf":
            return self._extract_pdf(content)
        if file_type == "docx":
            return self._extract_docx(content)
        raise UserVisibleError("Unsupported document type")

    def _extract_pdf(self, content: bytes) -> ExtractedDocument:
        pages: list[ExtractedPage] = []
        with fitz.open(stream=content, filetype="pdf") as document:
            for index, page in enumerate(document, start=1):
                lines = self._pdf_lines(page)
                pages.append({"page_number": index, "text": "\n".join(lines).strip()})
        return {"pages": pages}

    def _pdf_lines(self, page: fitz.Page) -> list[str]:
        # A PDF has no heading markup, so a line that is set noticeably larger
        # than the page's body text is the closest thing to one.
        raw_lines: list[tuple[str, float]] = []
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = line.get("spans", [])
                text = "".join(str(span.get("text", "")) for span in spans).strip()
                if not text:
                    continue
                size = max((float(span.get("size", 0.0)) for span in spans), default=0.0)
                raw_lines.append((text, size))

        if not raw_lines:
            return []

        body_size = statistics.median(size for _, size in raw_lines)
        lines: list[str] = []
        for text, size in raw_lines:
            level = self._pdf_heading_level(text, size, body_size)
            lines.append(f"{'#' * level} {text}" if level else text)
        return lines

    def _pdf_heading_level(self, text: str, size: float, body_size: float) -> int:
        if not body_size or len(text.split()) > _MAX_HEADING_WORDS:
            return 0
        if text.endswith((".", ",", ":", ";")):
            return 0

        ratio = size / body_size
        if ratio >= _HEADING_LEVEL_ONE:
            return 1
        if ratio >= _HEADING_LEVEL_TWO:
            return 2
        return 0

    def _extract_docx(self, content: bytes) -> ExtractedDocument:
        document = Document(BytesIO(content))
        lines: list[str] = []
        for paragraph in document.paragraphs:
            text = paragraph.text.strip()
            if not text:
                continue
            level = _docx_heading_level(paragraph)
            lines.append(f"{'#' * level} {text}" if level else text)
        return {"pages": [{"page_number": 1, "text": "\n".join(lines)}]}


def _docx_heading_level(paragraph: Paragraph) -> int:
    try:
        style_name = str(paragraph.style.name or "")
    except AttributeError:
        return 0

    if style_name == "Title":
        return 1
    if not style_name.startswith("Heading "):
        return 0

    depth = style_name.removeprefix("Heading ")
    return int(depth) if depth.isdigit() and 1 <= int(depth) <= 6 else 0
