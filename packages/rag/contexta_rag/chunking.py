from __future__ import annotations

import re
from typing import TypedDict

_TABLE_ROW_LIMIT_RATIO = 1.5
_SENTENCE_SNAP_RATIO = 0.85
_SENTENCE_TERMINATORS = (".", "!", "?", "…")
_SENTENCE_CLOSERS = ("\"", "'", "”", "’", ")", "]", "»")

_HEADING_MAX_WORDS = 7
_CAPTION_PREFIXES = frozenset(
    {"gambar", "tabel", "diagram", "grafik", "bagan", "figure", "table", "chart"}
)
_PAGE_NUMBER_ONLY = re.compile(r"[\d\s./-]+")
_PAGE_MARKER = re.compile(r"^(halaman|page)\s*\.?\s*\d+$", re.IGNORECASE)
_SENTENCE_PERIOD = re.compile(r"[A-Za-z]\.\s")


class TextChunk(TypedDict):
    chunk_index: int
    text: str
    start_word: int
    end_word: int


class PageText(TypedDict):
    page_number: int
    text: str


class PageChunk(TypedDict):
    chunk_index: int
    text: str
    page_number: int
    section_path: str | None
    is_table: bool
    start_word: int
    end_word: int


def chunk_text(
    text: str, max_words: int = 500, overlap_words: int = 100
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


def chunk_pages(
    pages: list[PageText],
    max_words: int = 500,
    overlap_words: int = 100,
    min_words: int = 40,
) -> list[PageChunk]:
    if max_words <= 0:
        raise ValueError("max_words must be greater than 0")
    if overlap_words < 0:
        raise ValueError("overlap_words must be greater than or equal to 0")
    if overlap_words >= max_words:
        raise ValueError("overlap_words must be smaller than max_words")
    if min_words < 0:
        raise ValueError("min_words must be greater than or equal to 0")
    if min_words >= max_words:
        raise ValueError("min_words must be smaller than max_words")

    document = _Document(pages)
    if not document:
        return []

    spans = document.window_spans(max_words, overlap_words)
    spans = document.merge_short_spans(spans, min_words)

    return [
        {
            "chunk_index": index,
            "text": document.render(start, end),
            "page_number": document.page_at(start),
            "section_path": document.section_at(start),
            "is_table": document.covers_table(start, end),
            "start_word": start,
            "end_word": end,
        }
        for index, (start, end) in enumerate(spans)
    ]


class _Document:
    """Words of every page flattened into one sequence, keeping line structure.

    Line boundaries survive flattening because a markdown table row that gets
    joined into a single space-separated run is no longer a table row.
    """

    def __init__(self, pages: list[PageText]) -> None:
        self.words: list[str] = []
        self.pages: list[int] = []
        self.line_of_word: list[int] = []
        self.line_bounds: list[tuple[int, int]] = []
        self.line_is_table: list[bool] = []
        self.line_section: list[str | None] = []
        headings: dict[int, str] = {}

        for page in pages:
            page_number = page["page_number"]
            for line in str(page["text"] or "").splitlines():
                words = line.split()
                if not words:
                    continue

                heading = _heading(words)
                if heading:
                    level, title = heading
                    words = words[1:]
                    if _is_section_title(title):
                        headings = {
                            saved_level: saved_title
                            for saved_level, saved_title in headings.items()
                            if saved_level < level
                        }
                        headings[level] = title

                line_id = len(self.line_bounds)
                self.line_bounds.append((len(self.words), len(self.words) + len(words)))
                self.line_is_table.append(words[0].startswith("|"))
                self.line_section.append(
                    " > ".join(headings[level] for level in sorted(headings)) or None
                )
                self.words.extend(words)
                self.pages.extend([page_number] * len(words))
                self.line_of_word.extend([line_id] * len(words))

    def __bool__(self) -> bool:
        return bool(self.words)

    @property
    def size(self) -> int:
        return len(self.words)

    def page_at(self, word_index: int) -> int:
        return self.pages[word_index]

    def section_at(self, word_index: int) -> str | None:
        return self.line_section[self.line_of_word[word_index]]

    def covers_table(self, start: int, end: int) -> bool:
        first_line = self.line_of_word[start]
        last_line = self.line_of_word[end - 1]
        return any(self.line_is_table[first_line : last_line + 1])

    def render(self, start: int, end: int) -> str:
        parts: list[str] = []
        for index in range(start, end):
            parts.append(self.words[index])
            if index + 1 < end and self._ends_line(index):
                parts.append("\n")
            elif index + 1 < end:
                parts.append(" ")
        return "".join(parts)

    def window_spans(
        self, max_words: int, overlap_words: int
    ) -> list[tuple[int, int]]:
        legal = self.legal_cut(max_words)
        sentence = self.sentence_cuts(legal)
        spans: list[tuple[int, int]] = []
        start = 0
        snap_floor = max(1, int(max_words * _SENTENCE_SNAP_RATIO))

        while start < self.size:
            ideal = min(start + max_words, self.size)
            end = self._choose_end(start, ideal, legal, sentence, start + snap_floor)
            spans.append((start, end))

            if end >= self.size:
                break

            next_start = end - overlap_words
            if next_start <= start:
                next_start = end
            while next_start < self.size and not legal[next_start]:
                next_start += 1
            start = next_start

        return spans

    def merge_short_spans(
        self, spans: list[tuple[int, int]], min_words: int
    ) -> list[tuple[int, int]]:
        if not spans or min_words <= 0:
            return spans

        merged: list[list[int]] = [list(spans[0])]
        for start, end in spans[1:]:
            if end - start < min_words:
                merged[-1][1] = max(merged[-1][1], end)
                continue
            merged.append([start, end])

        if len(merged) > 1 and merged[-1][1] - merged[-1][0] < min_words:
            merged[-2][1] = merged[-1][1]
            merged.pop()

        return [(start, end) for start, end in merged]

    def legal_cut(self, max_words: int) -> list[bool]:
        legal = [True] * (self.size + 1)
        for block_start, block_end in self._table_blocks():
            if self._is_wide_table(block_start, block_end, max_words):
                line_cuts = self._line_cuts(block_start, block_end)
            else:
                line_cuts = set()
            for cut in range(block_start + 1, block_end):
                if cut not in line_cuts:
                    legal[cut] = False
        return legal

    def sentence_cuts(self, legal: list[bool]) -> set[int]:
        closers = "".join(_SENTENCE_CLOSERS)
        return {
            cut
            for cut, word in enumerate(self.words, start=1)
            if legal[cut] and word.rstrip(closers).endswith(_SENTENCE_TERMINATORS)
        }

    def _choose_end(
        self,
        start: int,
        ideal: int,
        legal: list[bool],
        sentence: set[int],
        floor: int,
    ) -> int:
        if ideal >= self.size:
            return self.size

        floor = max(floor, start + 1)
        for cut in range(ideal, floor - 1, -1):
            if cut in sentence:
                return cut
        for cut in range(ideal, floor - 1, -1):
            if legal[cut]:
                return cut

        cut = ideal
        while cut < self.size and not legal[cut]:
            cut += 1
        if cut < self.size:
            return cut

        cut = floor
        while cut > start and not legal[cut]:
            cut -= 1
        return cut if cut > start else ideal

    def _ends_line(self, index: int) -> bool:
        return index + 1 >= self.size or self.line_of_word[index + 1] != self.line_of_word[index]

    def _table_blocks(self) -> list[tuple[int, int]]:
        blocks: list[tuple[int, int]] = []
        start: int | None = None

        for line_id, is_table in enumerate(self.line_is_table):
            if is_table and start is None:
                start = line_id
            elif not is_table and start is not None:
                blocks.append(
                    (self.line_bounds[start][0], self.line_bounds[line_id - 1][1])
                )
                start = None

        if start is not None:
            blocks.append(
                (self.line_bounds[start][0], self.line_bounds[len(self.line_bounds) - 1][1])
            )
        return blocks

    def _is_wide_table(self, start: int, end: int, max_words: int) -> bool:
        return end - start > max_words * _TABLE_ROW_LIMIT_RATIO

    def _line_cuts(self, start: int, end: int) -> set[int]:
        return {
            bound
            for bound in (self.line_bounds[line_id][1] for line_id in range(len(self.line_bounds)))
            if start < bound < end
        }


def _heading(words: list[str]) -> tuple[int, str] | None:
    marker = words[0]
    level = len(marker)
    if not marker.startswith("#") or level > 6 or marker != "#" * level:
        return None
    title = " ".join(words[1:]).strip()
    if not title:
        return None
    return level, title


def _is_section_title(title: str) -> bool:
    """Accept only headings that read like a section name.

    MarkItDown turns page numbers, raw HTML and figure captions into '#' lines,
    and every one of them would otherwise be stored as a chunk's section_path.
    The word cap is the caption separator: the longest real title in the indexed
    corpus is 7 words, every screenshot caption emitted as a heading is longer.
    Rejecting too much is the safe direction - the chunk then keeps the section
    it falls under instead of losing text.
    """
    words = title.split()
    if not words or len(words) > _HEADING_MAX_WORDS:
        return False
    if any(character in title for character in "<>|"):
        return False
    if _PAGE_NUMBER_ONLY.fullmatch(title):
        return False
    if _PAGE_MARKER.fullmatch(title):
        return False
    if _SENTENCE_PERIOD.search(title):
        return False
    if words[0][0].islower():
        return False
    if _is_caption(words):
        return False
    return True


def _is_caption(words: list[str]) -> bool:
    if words[0].lower().rstrip(".") not in _CAPTION_PREFIXES:
        return False
    if len(words) == 1:
        return True
    number = words[1].rstrip(".:")
    return bool(re.fullmatch(r"\d+(\.\d+)?", number))
