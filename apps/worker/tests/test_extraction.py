from io import BytesIO

import fitz
from docx import Document

from worker.extraction import DocumentTextExtractor


def test_extracts_pdf_text_by_page() -> None:
    pdf = fitz.open()
    page = pdf.new_page()
    page.insert_text((72, 72), "Hello PDF page")
    content = pdf.tobytes()
    pdf.close()

    extracted = DocumentTextExtractor().extract(content, "pdf")

    assert extracted["pages"] == [{"page_number": 1, "text": "Hello PDF page"}]


def test_extracts_docx_paragraph_text() -> None:
    document = Document()
    document.add_paragraph("Hello DOCX")
    document.add_paragraph("Second paragraph")
    buffer = BytesIO()
    document.save(buffer)

    extracted = DocumentTextExtractor().extract(buffer.getvalue(), "docx")

    assert extracted["pages"] == [
        {"page_number": 1, "text": "Hello DOCX\nSecond paragraph"}
    ]
