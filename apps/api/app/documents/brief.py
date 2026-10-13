"""Structured brief extraction: sample evenly across the document, then merge.

The brief used to read a 14k-character prefix and stop, so on a real thesis it saw about
four chunks out of five hundred and still presented itself as a summary of the whole
document. This samples a fixed number of contiguous windows spread over the corpus and
reports the coverage it actually achieved, which is the honest ceiling for a fixed
number of model calls.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

from app.chat.llm import AnswerGenerator
from app.documents.models import DocumentChunkResponse

BRIEF_WINDOW_CHARS = 12_000
BRIEF_MAX_WINDOWS = 4
BRIEF_MAX_POINTS = 8
BRIEF_MAX_ENTITIES = 20
BRIEF_MAX_QUESTIONS = 5

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
    "If a field has no evidence in the text, return an empty list for it."
)


class BriefModelError(RuntimeError):
    """The model answered with something we cannot turn into a brief."""


def _json_contract(language: str) -> str:
    # Not str.format: the contract itself shows a JSON object, and format would read
    # those braces as field names.
    return _JSON_CONTRACT.replace("{language}", language)


@dataclass(frozen=True)
class BriefContext:
    windows: list[str]
    total_chars: int

    @property
    def coverage(self) -> float:
        if self.total_chars <= 0:
            return 0.0
        return min(1.0, sum(len(window) for window in self.windows) / self.total_chars)


def detect_language(text: str) -> str:
    """Pick the document's own language so an English paper does not get an Indonesian brief."""
    words = re.findall(r"[a-z']+", text.lower()[:20_000])
    indonesian = sum(1 for word in words if word in INDONESIAN_MARKERS)
    english = sum(1 for word in words if word in ENGLISH_MARKERS)
    return "English" if english > indonesian else "Bahasa Indonesia"


def build_windows(
    chunks: list[DocumentChunkResponse],
    window_chars: int = BRIEF_WINDOW_CHARS,
    max_windows: int = BRIEF_MAX_WINDOWS,
) -> BriefContext:
    texts = [chunk.text.strip() for chunk in chunks if chunk.text.strip()]
    total_chars = sum(len(text) for text in texts)
    if total_chars <= window_chars or max_windows <= 1:
        return BriefContext(windows=["\n\n".join(texts)], total_chars=total_chars)

    # One call carries roughly this many consecutive chunks.
    average = total_chars / len(texts)
    fit = max(1, int(window_chars // (average + 2)))
    fit = min(fit, len(texts))
    last_start = len(texts) - fit
    step = last_start / (max_windows - 1)

    windows: list[str] = []
    for index in range(max_windows):
        # The last offset is the final one that still fits, so the document's closing
        # chunks are always read; bucketing the corpus first used to drop its tail.
        start = round(index * step)
        size = 0
        kept: list[str] = []
        for text in texts[start : start + fit]:
            if size + len(text) > window_chars:
                break
            kept.append(text)
            size += len(text)
        if kept:
            windows.append("\n\n".join(kept))
    return BriefContext(windows=windows, total_chars=total_chars)


def build_window_prompt(document_name: str, language: str, window: str, part: int, of: int) -> str:
    span = f"section {part} of {of}" if of > 1 else "the whole document"
    return (
        f"You are a document analyst. Summarize {span} of the document '{document_name}'.\n\n"
        + _json_contract(language)
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
        + _json_contract(language)
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


def parse_brief_json(raw: str) -> dict:
    try:
        payload = json.loads(_first_object(raw))
    except (json.JSONDecodeError, TypeError) as exc:
        raise BriefModelError(f"could not parse the model reply as JSON: {exc}") from exc
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
