"""PDF/DOCX text extraction, shared by indexing and by the Markdown download.

This lived only in the worker, which meant the web app's Convert page ran a different
extractor than the one whose text became the index: the markdown a user copied was not
the text Contexta answered from.

Lines within a page are sorted by geometric position (y0, x0) so the output follows
reading order top-to-bottom, left-to-right. fitz returns blocks in content-stream order,
which can differ from visual order when a PDF producer draws columns or footnotes first.
The per-line sort pairs each line with its baseline y-coordinate so a heading that sits
above a paragraph is emitted first, even if the content stream had them reversed.

``fitz`` loads with the module since both callers ship PyMuPDF; ``docx`` loads inside
the docx branch so a PDF-only process never needs python-docx.
"""

from __future__ import annotations

import statistics
from io import BytesIO
from typing import Any, TypedDict

import fitz

ExtractedPage = TypedDict("ExtractedPage", {"page_number": int, "text": str})
ExtractedDocument = TypedDict("ExtractedDocument", {"pages": list[ExtractedPage]})

_MAX_HEADING_WORDS = 12
_HEADING_LEVEL_ONE = 1.35
_HEADING_LEVEL_TWO = 1.15


class UnsupportedDocumentTypeError(ValueError):
    """Raised for a file type this extractor has no reader for."""


class DocumentTextExtractor:
    def extract(self, content: bytes, file_type: str) -> ExtractedDocument:
        if file_type == "pdf":
            return self._extract_pdf(content)
        if file_type == "docx":
            return self._extract_docx(content)
        raise UnsupportedDocumentTypeError("Unsupported document type")

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
        # Lines are sorted by (y0, x0) so the output follows visual reading order
        # rather than the content-stream order fitz returns.
        raw_lines: list[tuple[str, float, float, float]] = []
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = line.get("spans", [])
                text = "".join(str(span.get("text", "")) for span in spans).strip()
                if not text:
                    continue
                size = max((float(span.get("size", 0.0)) for span in spans), default=0.0)
                bbox = line.get("bbox", (0, 0, 0, 0))
                y0 = float(bbox[1]) if len(bbox) > 1 else 0.0
                x0 = float(bbox[0]) if len(bbox) > 0 else 0.0
                raw_lines.append((text, size, y0, x0))

        if not raw_lines:
            return []

        raw_lines.sort(key=lambda item: (item[2], item[3]))

        body_size = statistics.median(size for _, size, _, _ in raw_lines)
        lines: list[str] = []
        for text, size, _, _ in raw_lines:
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
        from docx import Document

        document = Document(BytesIO(content))
        lines: list[str] = []
        for paragraph in document.paragraphs:
            text = paragraph.text.strip()
            if not text:
                continue
            level = _docx_heading_level(paragraph)
            lines.append(f"{'#' * level} {text}" if level else text)
        return {"pages": [{"page_number": 1, "text": "\n".join(lines)}]}


def _docx_heading_level(paragraph: Any) -> int:
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


def to_markdown(document: ExtractedDocument) -> str:
    """The whole document as markdown, page by page, in extraction order."""
    return "\n\n".join(page["text"] for page in document["pages"] if page["text"])
