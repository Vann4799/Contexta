"""The worker's view of the shared extractor.

Only the error translation lives here: ``UserVisibleError`` is what lets a message reach
the document owner's browser verbatim (BUG-3), and the shared module has no idea what is
safe to show, so the mapping stays on this side.
"""

from __future__ import annotations

from contexta_rag.extraction import (
    DocumentTextExtractor as SharedDocumentTextExtractor,
)
from contexta_rag.extraction import (
    ExtractedDocument,
    ExtractedPage,
    UnsupportedDocumentTypeError,
)

from worker.processor import UserVisibleError

__all__ = [
    "DocumentTextExtractor",
    "ExtractedDocument",
    "ExtractedPage",
]


class DocumentTextExtractor:
    def __init__(self) -> None:
        self._shared = SharedDocumentTextExtractor()

    def extract(self, content: bytes, file_type: str) -> ExtractedDocument:
        try:
            return self._shared.extract(content, file_type)
        except UnsupportedDocumentTypeError as exc:
            raise UserVisibleError(str(exc)) from exc
