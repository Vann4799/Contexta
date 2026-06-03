from contexta_rag.prompts import build_rag_prompt


def test_prompt_uses_required_instruction_and_source_contract():
    prompt = build_rag_prompt(
        "What is Contexta?",
        [
            {
                "document_name": "overview.pdf",
                "page_number": 4,
                "text": "Contexta helps teams cite grounded answers.",
            }
        ],
    )

    assert prompt.startswith(
        "\n".join(
            [
                "You are Contexta, a careful document analysis assistant.",
                "Answer only from the provided sources.",
                "If the sources do not contain enough information, say that the document context is insufficient.",
                "Cite the source numbers that support the answer.",
            ]
        )
    )
    assert "Sources:" in prompt
    assert "[Source 1]" in prompt
    assert "Document: overview.pdf" in prompt
    assert "Content:\nContexta helps teams cite grounded answers." in prompt
    assert "\n\nQuestion:\nWhat is Contexta?\n\nAnswer:" in prompt
    assert prompt.endswith("Answer:")
    assert "What is Contexta?" in prompt
    assert "Page 4" in prompt


def test_prompt_uses_page_unknown_when_page_number_is_missing():
    prompt = build_rag_prompt(
        "What changed?",
        [
            {
                "document_name": "notes.md",
                "text": "The retrieval layer now shares utilities.",
            }
        ],
    )

    assert "Page unknown" in prompt


def test_prompt_uses_no_sources_message_when_contexts_are_empty():
    prompt = build_rag_prompt("What changed?", [])

    assert "Sources:\nNo sources were retrieved." in prompt
    assert prompt.endswith("Answer:")
