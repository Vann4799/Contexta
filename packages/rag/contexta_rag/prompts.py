from typing import NotRequired, TypedDict


class CitationContext(TypedDict):
    document_name: str
    text: str
    page_number: NotRequired[int | None]
    section_path: NotRequired[str | None]


def build_rag_prompt(question: str, contexts: list[CitationContext]) -> str:
    source_blocks = []
    for index, context in enumerate(contexts, start=1):
        page_number = context.get("page_number")
        page_label = f"Page {page_number}" if page_number is not None else "Page unknown"
        section_path = context.get("section_path")
        location_lines = [page_label]
        if section_path:
            location_lines.append(f"Section: {section_path}")
        source_blocks.append(
            "\n".join(
                [
                    f"[Source {index}]",
                    f"Document: {context['document_name']}",
                    *location_lines,
                    "Content:",
                    context["text"],
                ]
            )
        )

    sources = "\n\n".join(source_blocks) if source_blocks else "No sources were retrieved."

    instructions = "\n".join(
        [
            "You are Contexta, a careful document analysis assistant.",
            "Answer only from the provided sources.",
            "If the sources do not contain enough information, say that the document context is insufficient.",
            "Do not infer document-wide totals, counts, or rankings from partial sources. Only give those numbers when the sources explicitly contain complete totals or all relevant rows.",
            "Cite every statement you take from a source with the exact marker [Source N] at the end of that sentence, "
            "where N is the source number above. Do not use any other citation format, and never cite a number that is not listed.",
        ]
    )

    return (
        f"{instructions}\n\n"
        f"Sources:\n{sources}\n\n"
        f"Question:\n{question}\n\n"
        "Answer:"
    )
