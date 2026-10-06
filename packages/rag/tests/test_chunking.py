import pytest

from contexta_rag.chunking import chunk_pages, chunk_text


def _words(count: int, prefix: str = "w", terminal: bool = False) -> str:
    body = " ".join(f"{prefix}{index}" for index in range(count))
    return f"{body}." if terminal else body


def _covered(chunks) -> set[int]:
    covered: set[int] = set()
    for chunk in chunks:
        covered.update(range(chunk["start_word"], chunk["end_word"]))
    return covered


def test_short_text_returns_one_chunk_with_word_offsets():
    chunks = chunk_text("one two three")

    assert chunks == [
        {
            "chunk_index": 0,
            "text": "one two three",
            "start_word": 0,
            "end_word": 3,
        }
    ]


def test_overlapping_chunks_for_ten_words():
    chunks = chunk_text(
        "one two three four five six seven eight nine ten",
        max_words=4,
        overlap_words=1,
    )

    assert [chunk["text"] for chunk in chunks] == [
        "one two three four",
        "four five six seven",
        "seven eight nine ten",
    ]
    assert [chunk["chunk_index"] for chunk in chunks] == [0, 1, 2]


def test_overlap_words_must_be_smaller_than_max_words():
    with pytest.raises(
        ValueError, match="overlap_words must be smaller than max_words"
    ):
        chunk_text("one two three four", max_words=4, overlap_words=4)


def test_chunk_pages_returns_nothing_for_empty_input():
    assert chunk_pages([]) == []
    assert chunk_pages([{"page_number": 1, "text": "   \n\n  "}]) == []


def test_chunk_pages_validates_arguments():
    pages = [{"page_number": 1, "text": _words(10)}]

    with pytest.raises(ValueError, match="max_words must be greater than 0"):
        chunk_pages(pages, max_words=0)
    with pytest.raises(ValueError, match="min_words must be smaller than max_words"):
        chunk_pages(pages, max_words=100, overlap_words=10, min_words=100)


def test_windows_span_pages_instead_of_resetting_each_page():
    pages = [
        {"page_number": page_id, "text": _words(30, prefix=f"p{page_id}", terminal=True)}
        for page_id in (11, 12, 13)
    ]

    chunks = chunk_pages(pages, max_words=500, overlap_words=100, min_words=40)

    assert len(chunks) == 1
    assert chunks[0]["page_number"] == 11
    assert len(chunks[0]["text"].split()) == 90


def test_chunk_keeps_page_where_it_starts():
    pages = [
        {"page_number": 5, "text": _words(60, prefix="a")},
        {"page_number": 6, "text": _words(60, prefix="b")},
    ]

    chunks = chunk_pages(pages, max_words=50, overlap_words=10, min_words=5)

    assert [chunk["page_number"] for chunk in chunks] == [5, 5, 6]
    assert chunks[0]["start_word"] == 0
    assert chunks[-1]["end_word"] == 120
    assert _covered(chunks) == set(range(120))


def test_window_closes_on_a_sentence_not_mid_sentence():
    groups = [" ".join(f"s{n}{i}" for i in range(24)) for n in range(6)]
    pages = [{"page_number": 1, "text": " . ".join(groups) + " ."}]

    chunks = chunk_pages(pages, max_words=30, overlap_words=5, min_words=5)

    assert [chunk["end_word"] for chunk in chunks] == [25, 50, 75, 100, 125, 150]
    assert chunks[0]["text"].endswith("s023 .")


def test_short_tail_chunk_is_merged_into_its_neighbour():
    pages = [{"page_number": 1, "text": _words(165)}]

    chunks = chunk_pages(pages, max_words=50, overlap_words=10, min_words=40)

    assert [len(chunk["text"].split()) for chunk in chunks] == [50, 50, 50, 45]
    assert _covered(chunks) == set(range(165))


def test_small_table_block_is_never_split_across_chunks():
    table = "\n".join(["| nama | nilai |", "| a | 1 |", "| b | 2 |"])
    pages = [
        {
            "page_number": 7,
            "text": f"{_words(20, prefix='prose')}\n{table}\n{_words(20, prefix='tail')}",
        }
    ]

    chunks = chunk_pages(pages, max_words=18, overlap_words=4, min_words=3)

    intact = [chunk for chunk in chunks if "| a | 1 |" in chunk["text"]]
    assert len(intact) == 1
    assert "| b | 2 |" in intact[0]["text"]
    for chunk in chunks:
        for line in chunk["text"].splitlines():
            if line.strip().startswith("|"):
                assert line.count("|") == 3


def test_wide_table_breaks_only_between_rows():
    rows = ["| nama | nilai |"] + [f"| item{i} | {i} |" for i in range(40)]
    pages = [{"page_number": 1, "text": "\n".join(rows)}]

    chunks = chunk_pages(pages, max_words=20, overlap_words=5, min_words=5)

    assert len(chunks) > 1
    for chunk in chunks:
        lines = [line for line in chunk["text"].splitlines() if line.strip()]
        assert all(line.count("|") == 3 for line in lines)
    assert _covered(chunks) == set(range(len(pages[0]["text"].split())))


def test_chunks_carry_the_heading_trail_they_start_under():
    pages = [
        {
            "page_number": 40,
            "text": (
                "## BAB IV HASIL DAN PEMBAHASAN\n"
                "### 4.2 Metode Pengujian\n"
                + _words(30, prefix="metode")
                + "\n### 4.3 Hasil\n"
                + _words(30, prefix="hasil")
            ),
        }
    ]

    chunks = chunk_pages(pages, max_words=45, overlap_words=5, min_words=5)

    assert [chunk["section_path"] for chunk in chunks] == [
        "BAB IV HASIL DAN PEMBAHASAN",
        "BAB IV HASIL DAN PEMBAHASAN > 4.3 Hasil",
    ]
    assert "##" not in "".join(chunk["text"] for chunk in chunks)


def test_is_table_marks_only_chunks_that_span_a_table_row():
    pages = [
        {
            "page_number": 9,
            "text": (
                _words(20, prefix="prose")
                + "\n| nama | nilai |\n| a | 1 |"
                + "\n"
                + _words(20, prefix="tail")
            ),
        }
    ]

    chunks = chunk_pages(pages, max_words=15, overlap_words=0, min_words=3)

    assert any(chunk["is_table"] for chunk in chunks)
    assert any(not chunk["is_table"] for chunk in chunks)
    for chunk in chunks:
        has_row = any(
            line.strip().startswith("|") for line in chunk["text"].splitlines()
        )
        assert chunk["is_table"] == has_row
