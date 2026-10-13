from __future__ import annotations

import json

import pytest

from app.chat.llm import AnswerResult
from app.documents.brief import (
    BRIEF_MAX_ENTITIES,
    BRIEF_MAX_WINDOWS,
    BRIEF_WINDOW_CHARS,
    BriefModelError,
    BriefNoTextError,
    build_merge_prompt,
    build_window_prompt,
    build_windows,
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


def test_every_window_is_filled_to_its_budget() -> None:
    """Sampling by chunk count gave the live thesis 2 chunks per window: 5.6k of a 12k budget."""
    context = build_windows(chunks_of(400, 200), window_chars=12_000, max_windows=4)

    assert [len(window) for window in context.windows] == [12_000] * 4
    assert context.coverage > 0.55
    assert context.read_chars <= context.total_chars


def reference_entries(count: int) -> str:
    return "DAFTAR PUSTAKA\n" + "\n".join(
        f"Author, K. ({2020 + index % 6}). Judul penelitian nomor {index}."
        for index in range(count)
    )


def test_a_closing_bibliography_is_never_read() -> None:
    context = build_windows(
        [chunk(index, f"Isi bab {index} " + "x" * 3_000) for index in range(10)]
        + [chunk(10, "Saran: evaluasi pengaruh gamifikasi terhadap motivasi siswa."),
         chunk(11, reference_entries(300))],
        window_chars=12_000,
        max_windows=4,
    )

    assert not any("Author, K." in window for window in context.windows)
    assert "Saran: evaluasi pengaruh gamifikasi" in context.windows[-1]
    assert context.coverage < 1.0


def body_chunks(size: int, count: int) -> list:
    return [chunk(index, f"Isi bab {index} " + "x" * size) for index in range(1, count)] + [
        chunk(count, "Bagian terakhir skripsi ini membahas simpulan.")
    ]


def test_a_reference_heading_at_the_front_of_a_document_does_not_cut_it() -> None:
    """An approval page can name the bibliography; only a late heading is the document's tail."""
    context = build_windows(
        [chunk(0, "Halaman pengesahan\nDAFTAR PUSTAKA"), *body_chunks(6_000, 8)],
        window_chars=12_000,
        max_windows=4,
    )

    assert "Bagian terakhir skripsi ini membahas simpulan." in context.windows[-1]


def test_a_document_that_is_mostly_citations_keeps_them() -> None:
    context = build_windows(
        [chunk(0, "Simpulan singkat.")] + [chunk(1, reference_entries(600))],
        window_chars=12_000,
        max_windows=4,
    )

    assert any("nomor 599" in window for window in context.windows)
    assert context.read_chars <= context.total_chars


def test_a_document_without_a_text_layer_never_reaches_the_model() -> None:
    """A scanned page indexes to empty chunks; summarizing it used to cost a full call."""
    with pytest.raises(BriefNoTextError):
        build_windows([chunk(0, "   "), chunk(1, "\n\n")])

    generator = ScriptedGenerator([brief_json()])
    with pytest.raises(BriefNoTextError):
        generate_brief(generator, "scan.pdf", [chunk(0, "")])
    assert generator.prompts == []


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


def english_chunks(count: int) -> list[DocumentChunkResponse]:
    return [
        chunk(
            index,
            "The quarterly report shows that the team will ship the feature and "
            f"that revenue rose. Section {index} " + "result " * 60,
        )
        for index in range(count)
    ]


def indonesian_chunks(count: int) -> list[DocumentChunkResponse]:
    return [
        chunk(
            index,
            "Laporan ini menunjukkan bahwa tim akan merilis fitur baru dan pendapatan "
            f"naik. Bagian {index} " + "hasil " * 60,
        )
        for index in range(count)
    ]


def test_every_call_of_a_multi_section_run_asks_for_the_documents_language() -> None:
    """3.6 - a mixed run must not ask for Indonesian in one section and English in the merge."""
    answers = [brief_json(summary=f"Part {i}") for i in range(BRIEF_MAX_WINDOWS)]
    answers.append(brief_json(summary="Whole document."))
    english = ScriptedGenerator(list(answers))
    generate_brief(english, "report.pdf", english_chunks(400))
    assert len(english.prompts) == BRIEF_MAX_WINDOWS + 1
    assert all("in English" in prompt for prompt in english.prompts)

    indonesian = ScriptedGenerator(list(answers))
    generate_brief(indonesian, "laporan.pdf", indonesian_chunks(400))
    assert all("in Bahasa Indonesia" in prompt for prompt in indonesian.prompts)


def test_an_english_document_gets_an_english_payload_and_headings() -> None:
    generator = ScriptedGenerator([brief_json()])

    result = generate_brief(generator, "report.pdf", english_chunks(3))

    assert result["language"] == "English"
    assert "**1. Summary**" in result["brief"]


def test_a_single_long_chunk_is_still_read() -> None:
    """3.7 - one oversized table or OCR block used to make a whole window empty."""
    context = build_windows(
        [chunk(0, "y" * (BRIEF_WINDOW_CHARS * 2)), *chunks_of(200, 120)],
        window_chars=BRIEF_WINDOW_CHARS,
        max_windows=4,
    )

    assert len(context.windows) == 4
    assert all(window for window in context.windows)
    assert all(len(window) <= BRIEF_WINDOW_CHARS for window in context.windows)
    assert context.windows[0].startswith("yyy")


def test_a_reply_cut_mid_value_keeps_what_was_written() -> None:
    """Production hit this: the answer budget truncated the JSON and the whole brief 502'd."""
    cut = (
        '{"summary": "Skripsi ini membangun sistem rekomendasi.", '
        '"key_points": ["Menggunakan collaborative filtering", "Evaluasi memakai NDCG"], '
        '"entities": {"persons": ["Vaneza"], "dates": ["2026"], "money": []}, '
        '"questions": ["Bagaimana skalabilit'
    )

    parsed = parse_brief_json(cut)

    assert parsed["summary"] == "Skripsi ini membangun sistem rekomendasi."
    assert parsed["key_points"] == [
        "Menggunakan collaborative filtering",
        "Evaluasi memakai NDCG",
    ]
    assert parsed["entities"]["persons"] == ["Vaneza"]
    assert parsed["questions"] == []


def test_a_reply_cut_before_any_value_is_still_a_failure() -> None:
    with pytest.raises(BriefModelError):
        parse_brief_json('{"summary": "panjang sekali tanpa akhir')


def test_each_call_is_told_how_long_its_answer_may_be() -> None:
    """One section is free to write thirty key points unless the prompt says otherwise."""
    window = build_window_prompt("riset.pdf", "Bahasa Indonesia", "isi", 1, 4)
    merge = build_merge_prompt("riset.pdf", "Bahasa Indonesia", [{}])

    assert "at most 4 key points" in window
    assert "at most 8 key points" in merge
    assert "{limits}" not in window
    assert "{limits}" not in merge


def test_table_rows_survive_sampling_and_entities_pass_through() -> None:
    table = "| Vendor | Tanggal | Jumlah |\n|---|---|---|\n| PT Maju | 12-03-2026 | Rp 45.000.000 |"
    chunks = [chunk(0, table), chunk(1, "Pembayaran vendor dilakukan tepat waktu.")]
    context = build_windows(chunks)
    generator = ScriptedGenerator(
        [
            json.dumps(
                {
                    "summary": "Dua vendor membayar tepat waktu.",
                    "key_points": ["PT Maju membayar Rp 45.000.000"],
                    "entities": {
                        "persons": ["PT Maju"],
                        "dates": ["12-03-2026"],
                        "money": ["Rp 45.000.000"],
                    },
                    "questions": ["Vendor mana yang terlambat?"],
                }
            )
        ]
    )

    result = generate_brief(generator, "invoice.pdf", chunks)

    assert table in context.windows[0]
    assert result["entities"]["money"] == ["Rp 45.000.000"]
    assert result["entities"]["dates"] == ["12-03-2026"]
    assert result["coverage"] == 1.0
