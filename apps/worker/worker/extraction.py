from __future__ import annotations

from io import BytesIO

import fitz
from docx import Document

from worker.processor import ExtractedDocument, ExtractedPage


class DocumentTextExtractor:
    def extract(self, content: bytes, file_type: str) -> ExtractedDocument:
        if file_type == "pdf":
            return self._extract_pdf(content)
        if file_type == "docx":
            return self._extract_docx(content)
        raise ValueError("Unsupported document type")

    def _extract_pdf(self, content: bytes) -> ExtractedDocument:
        pages: list[ExtractedPage] = []
        with fitz.open(stream=content, filetype="pdf") as document:
            for index, page in enumerate(document, start=1):
                pages.append(
                    {
                        "page_number": index,
                        "text": page.get_text("text").strip(),
                    }
                )
        return {"pages": pages}

    def _extract_docx(self, content: bytes) -> ExtractedDocument:
        document = Document(BytesIO(content))
        paragraphs = [
            paragraph.text.strip()
            for paragraph in document.paragraphs
            if paragraph.text.strip()
        ]
        return {
            "pages": [
                {
                    "page_number": 1,
                    "text": "\n".join(paragraphs),
                }
            ]
        }
