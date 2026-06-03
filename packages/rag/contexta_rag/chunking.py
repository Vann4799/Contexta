from typing import TypedDict


class TextChunk(TypedDict):
    chunk_index: int
    text: str
    start_word: int
    end_word: int


def chunk_text(
    text: str, max_words: int = 800, overlap_words: int = 120
) -> list[TextChunk]:
    if max_words <= 0:
        raise ValueError("max_words must be greater than 0")
    if overlap_words < 0:
        raise ValueError("overlap_words must be greater than or equal to 0")
    if overlap_words >= max_words:
        raise ValueError("overlap_words must be smaller than max_words")

    words = text.split()
    if not words:
        return []

    chunks: list[TextChunk] = []
    step = max_words - overlap_words
    start_word = 0

    while start_word < len(words):
        end_word = min(start_word + max_words, len(words))
        chunks.append(
            {
                "chunk_index": len(chunks),
                "text": " ".join(words[start_word:end_word]),
                "start_word": start_word,
                "end_word": end_word,
            }
        )

        if end_word == len(words):
            break
        start_word += step

    return chunks
