from contexta_rag.prompts import (
    MAX_HISTORY_TURNS,
    MAX_HISTORY_TURN_CHARS,
    build_query_rewrite_prompt,
    build_rag_prompt,
)


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
                "Do not infer document-wide totals, counts, or rankings from partial sources. Only give those numbers when the sources explicitly contain complete totals or all relevant rows.",
            ]
        )
    )
    assert "the exact marker [Source N] at the end of that sentence" in prompt
    assert "Do not use any other citation format" in prompt
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


def test_prompt_omits_history_block_when_no_history_given():
    prompt = build_rag_prompt("What changed?", [{"document_name": "a.md", "text": "text"}])

    assert "Earlier turns" not in prompt


def test_prompt_includes_history_as_non_citable_context():
    prompt = build_rag_prompt(
        "terus hasilnya gimana?",
        [{"document_name": "a.md", "text": "Hasil pengujian."}],
        history=[
            {"role": "user", "content": "Apa metode pengujian yang dipakai?"},
            {"role": "assistant", "content": "Black Box Testing [Source 1]."},
        ],
    )

    history_section = prompt.split("Sources:")[0]
    assert "Earlier turns in this conversation" in history_section
    assert "never cite them" in history_section
    assert "User: Apa metode pengujian yang dipakai?" in history_section
    assert "Assistant: Black Box Testing [Source 1]." in history_section
    assert "terus hasilnya gimana?" in prompt.split("Question:")[1]


def test_prompt_bounds_history_by_turn_count_and_length():
    history = [
        {"role": "user", "content": f"q{index} " + "x" * 400}
        for index in range(MAX_HISTORY_TURNS + 4)
    ]

    prompt = build_rag_prompt("latest?", [{"document_name": "a.md", "text": "t"}], history=history)

    assert f"q{MAX_HISTORY_TURNS + 3}" in prompt
    assert "q0 " not in prompt
    assert "x" * (MAX_HISTORY_TURN_CHARS + 1) not in prompt


def test_rewrite_prompt_asks_for_a_standalone_query_only():
    prompt = build_query_rewrite_prompt(
        "terus hasilnya gimana?",
        [
            {"role": "user", "content": "Apa metode pengujian yang dipakai?"},
            {"role": "assistant", "content": "Black Box Testing dipakai ke seluruh fitur."},
        ],
    )

    assert "standalone search query" in prompt
    assert "no answer, no prefix" in prompt
    assert "Black Box Testing dipakai ke seluruh fitur." in prompt
    assert prompt.endswith("terus hasilnya gimana?\n\nStandalone search query:")
