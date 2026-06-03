from typing import NotRequired, TypedDict


class CitationContext(TypedDict):
    document_name: str
    text: str
    page_number: NotRequired[int | None]


def build_rag_prompt(question: str, contexts: list[CitationContext]) -> str:
    source_blocks = []
    for index, context in enumerate(contexts, start=1):
        page_number = context.get("page_number")
        page_label = f"Page {page_number}" if page_number is not None else "Page unknown"
        source_blocks.append(
            "\n".join(
                [
                    f"Source {index}: {context['document_name']} ({page_label})",
                    context["text"],
                ]
            )
        )

    sources = "\n\n".join(source_blocks) if source_blocks else "No sources provided."

    return "\n\n".join(
        [
            "Answer the question using only the sources below.",
            "If the sources do not contain enough information, say you do not know based on the provided sources.",
            f"Question: {question}",
            "Sources:",
            sources,
        ]
    )
