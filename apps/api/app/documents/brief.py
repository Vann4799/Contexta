"""Structured brief extraction: sample evenly across the document, then merge.

The brief used to read a 14k-character prefix and stop, so on a real thesis it saw the
first few pages and still presented itself as a summary of the whole document. This
samples a fixed number of windows, each filled to its character budget, spread over the
corpus, and reports the coverage it actually achieved - the honest ceiling for a fixed
number of model calls. A closing bibliography is not sampled; it is a list of citations,
not content.
"""

from __future__ import annotations

import json
import logging
import re
from bisect import bisect_right
from dataclasses import dataclass

from app.chat.llm import AnswerGenerator
from app.documents.models import DocumentChunkResponse

logger = logging.getLogger(__name__)

BRIEF_WINDOW_CHARS = 12_000
BRIEF_MAX_WINDOWS = 4
BRIEF_MAX_POINTS = 8
BRIEF_MAX_ENTITIES = 20
BRIEF_MAX_QUESTIONS = 5

CHUNK_SEPARATOR = "\n\n"

# A bibliography heading alone on its line. Dot leaders and page numbers are excluded on
# purpose: a table of contents carries the same words and must not cut the document.
REFERENCE_HEADING = re.compile(
    r"^[ \t#*_-]*(DAFTAR\s+PUSTAKA|DAFTAR\s+RUJUKAN|DAFTAR\s+REFERENSI|REFERENCES|BIBLIOGRAPHY)"
    r"[ \t#*_-]*$",
    re.IGNORECASE | re.MULTILINE,
)
REFERENCE_TAIL_MIN_OFFSET = 0.5

INDONESIAN_MARKERS = {
    "yang", "dan", "dari", "dalam", "dengan", "untuk", "pada", "adalah", "ini", "itu",
    "atau", "tidak", "juga", "akan", "oleh", "sebagai", "kami", "saya", "telah", "bisa",
}
ENGLISH_MARKERS = {
    "the", "and", "of", "to", "in", "is", "for", "with", "that", "on", "are", "as",
    "be", "by", "this", "from", "or", "it", "an", "was", "we", "you",
}

_JSON_CONTRACT = (
    "Reply with ONE JSON object and nothing else - no markdown fence, no preamble:\n"
    '{"summary": string, "key_points": [string], '
    '"entities": {"persons": [string], "dates": [string], "money": [string]}, '
    '"questions": [string]}\n'
    "Write every string value in {language}. Use text from the document only; never invent names, dates or amounts. "
    "If a field has no evidence in the text, return an empty list for it.\n"
    "{limits}"
)
# A section call that is free to write thirty key points can run past the answer token
# budget and come back with its JSON cut mid-value, which discards every call of the run.
WINDOW_LIMITS = (
    "This is one section of a longer document, so keep it short: a summary under 400 "
    "characters, at most 4 key points, at most 6 entries in each entity list, and at "
    "most 2 questions."
)
MERGE_LIMITS = (
    "This is the final analysis of the whole document: a summary under 1500 characters, "
    "at most 8 key points, at most 20 entries in each entity list, and at most 5 questions."
)


class BriefModelError(RuntimeError):
    """The model answered with something we cannot turn into a brief."""


class BriefNoTextError(BriefModelError):
    """The document has no readable text at all, so there is nothing to summarize."""


def _json_contract(language: str, limits: str) -> str:
    # Not str.format: the contract itself shows a JSON object, and format would read
    # those braces as field names.
    return _JSON_CONTRACT.replace("{language}", language).replace("{limits}", limits)


@dataclass(frozen=True)
class BriefContext:
    windows: list[str]
    total_chars: int
    read_chars: int

    @property
    def coverage(self) -> float:
        if self.total_chars <= 0:
            return 0.0
        return min(1.0, self.read_chars / self.total_chars)


def detect_language(text: str) -> str:
    """Pick the document's own language so an English paper does not get an Indonesian brief."""
    words = re.findall(r"[a-z']+", text.lower()[:20_000])
    indonesian = sum(1 for word in words if word in INDONESIAN_MARKERS)
    english = sum(1 for word in words if word in ENGLISH_MARKERS)
    return "English" if english > indonesian else "Bahasa Indonesia"


def _pack_forward(texts: list[str], start: int, budget: int) -> list[str]:
    """Consecutive chunks from `start` while they fit the budget."""
    kept: list[str] = []
    size = 0
    for text in texts[start:]:
        separator = len(CHUNK_SEPARATOR) if kept else 0
        room = budget - size - separator
        if room <= 0:
            break
        if len(text) > room:
            # A chunk longer than the remaining budget would otherwise leave the window
            # short, so its head is read instead.
            kept.append(text[:room])
            break
        kept.append(text)
        size += separator + len(text)
    return kept


def _pack_backward(texts: list[str], budget: int) -> tuple[list[str], int]:
    """The closing chunks of the corpus, with the overflowing chunk read from its tail."""
    kept: list[str] = []
    size = 0
    for index in range(len(texts) - 1, -1, -1):
        text = texts[index]
        separator = len(CHUNK_SEPARATOR) if kept else 0
        room = budget - size - separator
        if room <= 0:
            break
        if len(text) > room:
            kept.append(text[len(text) - room :])
            return list(reversed(kept)), index + 1
        kept.append(text)
        size += separator + len(text)
    return list(reversed(kept)), max(0, len(texts) - len(kept))


def _split_reference_tail(texts: list[str]) -> tuple[list[str], int]:
    """Cut a closing bibliography, returning the readable chunks and the characters dropped.

    A reference list is a list of citations, not content, and one of the five brief calls
    was spending itself on other people's titles. Only a heading past half the corpus
    counts, because a table of contents line ("DAFTAR PUSTAKA ......... 113") sits at the
    front of the same document.
    """
    total = sum(len(text) for text in texts) + len(CHUNK_SEPARATOR) * (len(texts) - 1)
    offset = 0
    for index, text in enumerate(texts):
        heading = REFERENCE_HEADING.search(text)
        if heading is not None and offset + heading.start() >= total * REFERENCE_TAIL_MIN_OFFSET:
            kept = texts[:index]
            leading = text[: heading.start()].strip()
            if leading:
                kept = [*kept, leading]
            if sum(len(kept_text) for kept_text in kept) < total * REFERENCE_TAIL_MIN_OFFSET:
                # A document that is mostly citations keeps them; dropping half the
                # corpus would make the brief worse, not cheaper.
                return texts, 0
            return kept, total - sum(len(kept_text) for kept_text in kept) - len(
                CHUNK_SEPARATOR
            ) * (len(kept) - 1)
        offset += len(text) + len(CHUNK_SEPARATOR)
    return texts, 0


def build_windows(
    chunks: list[DocumentChunkResponse],
    window_chars: int = BRIEF_WINDOW_CHARS,
    max_windows: int = BRIEF_MAX_WINDOWS,
) -> BriefContext:
    texts = [chunk.text.strip() for chunk in chunks if chunk.text.strip()]
    if not texts:
        # A scanned page or an image-only PDF indexes to chunks without a text layer.
        # Sampling it used to spend a full model call to summarize nothing.
        raise BriefNoTextError("the document has no readable text")

    texts, dropped_chars = _split_reference_tail(texts)
    body_chars = sum(len(text) for text in texts) + len(CHUNK_SEPARATOR) * (len(texts) - 1)
    # Coverage stays measured against the whole document, bibliography included: the
    # brief really did not read it, it just has nothing in it worth a model call.
    total_chars = body_chars + dropped_chars
    if body_chars <= window_chars or max_windows <= 1:
        return BriefContext(
            windows=[CHUNK_SEPARATOR.join(texts)], total_chars=total_chars, read_chars=body_chars
        )

    # Offsets spread across the body, so the final window ends at the document's end.
    stride = (body_chars - window_chars) / (max_windows - 1)
    starts: list[int] = []
    running = 0
    for text in texts:
        starts.append(running)
        running += len(text) + len(CHUNK_SEPARATOR)

    windows: list[str] = []
    read_chars = 0
    cursor = 0
    for index in range(max_windows):
        if index == max_windows - 1:
            pieces, first = _pack_backward(texts, window_chars)
            if first < cursor:
                pieces, first = _pack_forward(texts, cursor, window_chars), cursor
        else:
            first = max(bisect_right(starts, round(index * stride)) - 1, cursor)
            pieces = _pack_forward(texts, first, window_chars)
        if not pieces:
            continue
        windows.append(CHUNK_SEPARATOR.join(pieces))
        separators = len(CHUNK_SEPARATOR) * (len(pieces) - 1)
        read_chars += sum(len(piece) for piece in pieces) + separators
        cursor = min(first + len(pieces), len(texts))
    return BriefContext(windows=windows, total_chars=total_chars, read_chars=read_chars)


def build_window_prompt(document_name: str, language: str, window: str, part: int, of: int) -> str:
    span = f"section {part} of {of}" if of > 1 else "the whole document"
    return (
        f"You are a document analyst. Summarize {span} of the document '{document_name}'.\n\n"
        + _json_contract(language, WINDOW_LIMITS)
        + "\n\nDocument text:\n"
        + window
    )


def build_merge_prompt(document_name: str, language: str, partials: list[dict]) -> str:
    payload = json.dumps(partials, ensure_ascii=False)
    return (
        f"You are a document analyst. Below are {len(partials)} separate JSON analyses of "
        f"different sections of the document '{document_name}'. Merge them into one analysis "
        "of the whole document: one coherent summary, the most important distinct key points, "
        "deduplicated entities, and the questions that best probe what the document leaves open.\n\n"
        + _json_contract(language, MERGE_LIMITS)
        + "\n\nSection analyses to merge:\n"
        + payload
    )


def _string_list(value: object, limit: int, max_chars: int) -> list[str]:
    if not isinstance(value, list):
        return []
    seen: set[str] = set()
    items: list[str] = []
    for entry in value:
        if isinstance(entry, dict):
            entry = entry.get("value") or entry.get("text")
        text = str(entry).strip().strip(".,;:") if entry is not None else ""
        if not text or text.lower() in seen:
            continue
        seen.add(text.lower())
        items.append(text[:max_chars])
        if len(items) >= limit:
            break
    return items


def _first_object(raw: str) -> str:
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end <= start:
        raise BriefModelError("the model returned no JSON object")
    return raw[start:end + 1]


def _close_truncated(raw: str) -> str | None:
    """Rebalance a JSON object the answer token budget cut off mid-value.

    Every value before the cut is still evidence from the document, so the longest
    complete tail is kept instead of throwing the whole section analysis away.
    """
    start = raw.find("{")
    if start == -1:
        return None
    body = raw[start:]
    stack: list[str] = []
    in_string = False
    escaped = False
    completed: list[tuple[int, tuple[str, ...]]] = []
    for index, char in enumerate(body):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
                completed.append((index + 1, tuple(stack)))
        elif char == '"':
            in_string = True
        elif char == "{":
            stack.append("}")
        elif char == "[":
            stack.append("]")
        elif char in "}]":
            if not stack or stack[-1] != char:
                return None
            stack.pop()
            completed.append((index + 1, tuple(stack)))
            if not stack:
                return None
        elif char in ",: \n\t\r":
            continue
        else:
            completed.append((index + 1, tuple(stack)))
    for cut, open_brackets in reversed(completed):
        candidate = body[:cut].rstrip().rstrip(",") + "".join(open_brackets)
        try:
            json.loads(candidate)
        except json.JSONDecodeError:
            continue
        return candidate
    return None


def parse_brief_json(raw: str) -> dict:
    try:
        payload = json.loads(_first_object(raw))
    except (json.JSONDecodeError, TypeError) as exc:
        rescued = _close_truncated(raw)
        if rescued is None:
            raise BriefModelError(f"could not parse the model reply as JSON: {exc}") from exc
        logger.warning("rescued a brief from a truncated model reply")
        payload = json.loads(rescued)
    if not isinstance(payload, dict):
        raise BriefModelError("the model reply was not a JSON object")

    entities = payload.get("entities")
    if not isinstance(entities, dict):
        entities = {}
    return {
        "summary": str(payload.get("summary") or "").strip()[:1500],
        "key_points": _string_list(payload.get("key_points"), BRIEF_MAX_POINTS, 300),
        "entities": {
            "persons": _string_list(entities.get("persons"), BRIEF_MAX_ENTITIES, 120),
            "dates": _string_list(entities.get("dates"), BRIEF_MAX_ENTITIES, 60),
            "money": _string_list(entities.get("money"), BRIEF_MAX_ENTITIES, 60),
        },
        "questions": _string_list(payload.get("questions"), BRIEF_MAX_QUESTIONS, 200),
    }


_HEADINGS = {
    "id": {
        "summary": "Ringkasan",
        "key_points": "Poin utama",
        "persons": "Nama yang disebut",
        "dates": "Tanggal",
        "money": "Nilai / angka",
        "questions": "Pertanyaan lanjutan",
    },
    "en": {
        "summary": "Summary",
        "key_points": "Key points",
        "persons": "Names mentioned",
        "dates": "Dates",
        "money": "Amounts",
        "questions": "Follow-up questions",
    },
}


def render_brief(brief: dict) -> str:
    """Flatten the structured brief into the prose the brief panel renders."""
    headings = _HEADINGS["id" if brief.get("language") != "English" else "en"]
    lines = [f"**1. {headings['summary']}**", brief.get("summary") or "-"]

    def section(title: str, items: list[str]) -> None:
        lines.append(f"**{title}**")
        if items:
            lines.extend(f"* {item}" for item in items)
        else:
            lines.append("-")

    section(f"2. {headings['key_points']}", brief.get("key_points") or [])
    entities = brief.get("entities") or {}
    section(f"3. {headings['persons']}", entities.get("persons") or [])
    section(f"4. {headings['dates']}", entities.get("dates") or [])
    section(f"5. {headings['money']}", entities.get("money") or [])
    section(f"6. {headings['questions']}", brief.get("questions") or [])
    return "\n\n".join(lines)


def generate_brief(
    generator: AnswerGenerator,
    document_name: str,
    chunks: list[DocumentChunkResponse],
) -> dict:
    """Run the sampled map-merge and return the persisted brief payload."""
    combined = "\n".join(chunk.text for chunk in chunks)
    language = detect_language(combined)
    context = build_windows(chunks)

    partials: list[dict] = []
    truncated = False
    total = len(context.windows)
    for index, window in enumerate(context.windows, start=1):
        result = generator.generate_answer(
            build_window_prompt(document_name, language, window, index, total)
        )
        truncated = truncated or result.truncated
        partials.append(parse_brief_json(result.content))

    if total > 1:
        result = generator.generate_answer(build_merge_prompt(document_name, language, partials))
        truncated = truncated or result.truncated
        merged = parse_brief_json(result.content)
    else:
        merged = partials[0]

    merged["language"] = language
    merged["coverage"] = round(context.coverage, 3)
    merged["truncated"] = truncated
    merged["sections_read"] = total
    merged["brief"] = render_brief(merged)
    return merged
