from __future__ import annotations

import json

import pytest

from app.chat.llm import AnswerResult
from app.documents.brief import (
    BRIEF_MAX_ENTITIES,
    BRIEF_MAX_WINDOWS,
    BriefModelError,
    build_windows,
    build_window_prompt,
    detect_language,
    generate_brief,
    parse_brief_json,
    render_brief,
)
from app.documents.models import DocumentChunkResponse


def chunk(index: int, text: str) -> DocumentChunkResponse:
    return DocumentChunkResponse(
        document_id="11111111-1111-4111-8111-111111111111",
        user_id="user-brief",
        chunk_index=index,
        text=text,
        page_number=1,
        qdrant_point_id=f"point-{index}",
    )


def chunks_of(count: int, size: int) -> list[DocumentChunkResponse]:
    return [chunk(index, f"chunk{index} " + "x" * size) for index in range(count)]


class ScriptedGenerator:
    """Replies with one canned JSON object per call, in order."""

    def __init__(self, answers: list[str]) -> None:
        self.answers = answers
        self.prompts: list[str] = []

    def generate_answer(self, prompt: str) -> AnswerResult:
        self.prompts.append(prompt)
        return AnswerResult(self.answers[len(self.prompts) - 1])


def brief_json(**overrides: object) -> str:
    payload: dict[str, object] = {
        "summary": "Section summary.",
        "key_points": ["Point A"],
        "entities": {"persons": ["Rifki Mardiyanto"], "dates": [], "money": []},
        "questions": ["What changed?"],
    }
    payload.update(overrides)
    return json.dumps(payload)


def test_windows_reach_the_end_of_a_long_document() -> None:
    """The old brief read a fixed prefix, so a thesis was summarized from its first pages."""
    context = build_windows(chunks_of(400, 200), window_chars=12_000, max_windows=4)

    assert len(context.windows) == 4
    assert "chunk0 " in context.windows[0]
    assert "chunk399 " in context.windows[-1]
    assert context.coverage < 1.0


def test_a_short_document_stays_one_window_and_full_coverage() -> None:
    context = build_windows(chunks_of(3, 50))

    assert len(context.windows) == 1
    assert context.coverage == 1.0


def test_an_empty_corpus_reports_no_coverage() -> None:
    assert build_windows([]).coverage == 0.0


def test_window_prompt_labels_the_section_and_demands_json() -> None:
    prompt = build_window_prompt("riset.pdf", "Bahasa Indonesia", "isi dokumen", 2, 4)

    assert "section 2 of 4" in prompt
    assert "riset.pdf" in prompt
    assert '"key_points"' in prompt
    assert "{language}" not in prompt
    assert "Bahasa Indonesia" in prompt


def test_english_prose_is_not_summarized_into_indonesian() -> None:
    assert detect_language("The report shows that the team will ship it next week.") == "English"
    assert detect_language(
        "Laporan ini menunjukkan bahwa tim akan merilisnya minggu depan."
    ) == "Bahasa Indonesia"


def test_parser_accepts_a_fenced_reply_with_preamble() -> None:
    raw = "Here you go:\n```json\n" + brief_json() + "\n```"

    parsed = parse_brief_json(raw)

    assert parsed["summary"] == "Section summary."
    assert parsed["entities"]["persons"] == ["Rifki Mardiyanto"]


def test_parser_keeps_only_fields_the_contract_declares() -> None:
    parsed = parse_brief_json(
        json.dumps(
            {
                "summary": "s",
                "key_points": ["a", "a", {"value": "b"}, "c"],
                "entities": {"persons": "Rifki", "dates": ["2026", "2026"]},
                "questions": [],
                "hallucinated": "x",
            }
        )
    )

    assert parsed["key_points"] == ["a", "b", "c"]
    assert parsed["entities"]["persons"] == []
    assert parsed["entities"]["dates"] == ["2026"]


def test_parser_trims_lists_to_their_limits() -> None:
    parsed = parse_brief_json(
        json.dumps({"entities": {"persons": [f"Person {i}" for i in range(60)]}})
    )

    assert len(parsed["entities"]["persons"]) == BRIEF_MAX_ENTITIES


def test_unparsable_replies_are_a_named_failure() -> None:
    with pytest.raises(BriefModelError):
        parse_brief_json("I could not find anything to summarize.")


def test_one_call_per_section_plus_a_merge() -> None:
    generator = ScriptedGenerator(
        [brief_json(summary=f"Part {i}") for i in range(BRIEF_MAX_WINDOWS)]
        + [brief_json(summary="Whole document.")]
    )

    result = generate_brief(generator, "riset.pdf", chunks_of(400, 200))

    assert generator.prompts[0].count("Document text:") == 1
    assert len(generator.prompts) == BRIEF_MAX_WINDOWS + 1
    assert "Merge them into one analysis" in generator.prompts[-1]
    assert result["summary"] == "Whole document."
    assert result["sections_read"] == BRIEF_MAX_WINDOWS
    assert result["coverage"] < 1.0


def test_a_single_window_skips_the_merge_call() -> None:
    generator = ScriptedGenerator([brief_json()])

    result = generate_brief(generator, "riset.pdf", chunks_of(2, 50))

    assert len(generator.prompts) == 1
    assert result["coverage"] == 1.0
    assert result["language"] == "Bahasa Indonesia"


def test_truncation_is_carried_out_of_the_model_calls() -> None:
    class TruncatingGenerator:
        def generate_answer(self, prompt: str) -> AnswerResult:
            return AnswerResult(brief_json(), truncated=True)

    result = generate_brief(TruncatingGenerator(), "riset.pdf", chunks_of(2, 50))

    assert result["truncated"] is True


def test_rendered_brief_uses_the_documents_own_language() -> None:
    english = render_brief(
        {"language": "English", "summary": "s", "key_points": ["a"], "entities": {}}
    )
    indonesian = render_brief(
        {"language": "Bahasa Indonesia", "summary": "s", "key_points": ["a"], "entities": {}}
    )

    assert "**1. Summary**" in english
    assert "**3. Names mentioned**" in english
    assert "**1. Ringkasan**" in indonesian
    assert "**3. Nama yang disebut**" in indonesian
