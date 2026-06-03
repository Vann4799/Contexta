from contexta_rag.prompts import build_rag_prompt


def test_prompt_includes_question_context_and_insufficient_sources_instruction():
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

    assert "What is Contexta?" in prompt
    assert "overview.pdf" in prompt
    assert "Page 4" in prompt
    assert "Contexta helps teams cite grounded answers." in prompt
    assert "If the sources do not contain enough information" in prompt


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
