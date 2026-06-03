import pytest

from contexta_rag.chunking import chunk_text


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
