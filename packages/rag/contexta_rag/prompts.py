from typing import NotRequired, TypedDict


class CitationContext(TypedDict):
    document_name: str
    text: str
    page_number: NotRequired[int | None]
    section_path: NotRequired[str | None]


class ConversationTurn(TypedDict):
    role: str
    content: str


MAX_HISTORY_TURNS = 6
MAX_HISTORY_TURN_CHARS = 300


def _history_block(history: list[ConversationTurn]) -> str:
    """Render prior turns as context that must never be cited.

    Without this the model sees chunks retrieved for a rewritten query but still
    cannot resolve "itu", so retrieval fixes and the answer stay out of sync.
    """
    lines = []
    for turn in history[-MAX_HISTORY_TURNS:]:
        speaker = "User" if turn["role"] == "user" else "Assistant"
        content = " ".join(turn["content"].split())[:MAX_HISTORY_TURN_CHARS]
        if content:
            lines.append(f"{speaker}: {content}")
    if not lines:
        return ""

    return (
        "Earlier turns in this conversation (context for resolving references only). "
        "They are not sources; never cite them.\n" + "\n".join(lines) + "\n\n"
    )


def build_rag_prompt(
    question: str,
    contexts: list[CitationContext],
    history: list[ConversationTurn] | None = None,
) -> str:
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
            "If the question refers to something from the earlier turns, read those turns only to work out what it refers to.",
        ]
    )

    return (
        f"{instructions}\n\n"
        f"{_history_block(history or [])}"
        f"Sources:\n{sources}\n\n"
        f"Question:\n{question}\n\n"
        "Answer:"
    )


def build_query_rewrite_prompt(
    question: str,
    history: list[ConversationTurn],
) -> str:
    """Ask for a standalone search query, not an answer.

    The output feeds an embedding model, so anything conversational is noise that
    pulls the retrieval away from the document.
    """
    turns = []
    for turn in history[-MAX_HISTORY_TURNS:]:
        speaker = "User" if turn["role"] == "user" else "Assistant"
        content = " ".join(turn["content"].split())[:MAX_HISTORY_TURN_CHARS]
        if content:
            turns.append(f"{speaker}: {content}")

    return "\n".join(
        [
            "You rewrite a follow-up question into one standalone search query.",
            "Resolve every pronoun and reference ('itu', 'ini', 'terus', 'it', 'that') using the conversation.",
            "Output the query only, on one line, with no answer, no prefix, and no punctuation at the end.",
            "Keep it under 25 words and use only words grounded in the conversation.",
            "If the follow-up already stands alone, repeat it unchanged.",
            "",
            "Conversation:",
            "\n".join(turns),
            "",
            "Follow-up question:",
            question,
            "",
            "Standalone search query:",
        ]
    )

