"""Decide whether a follow-up needs a rewrite, and whether the rewrite is usable.

Everything here is deterministic on purpose: the alternative is asking an LLM
"should we ask an LLM?", which costs the same latency and cannot be tested.
"""

from __future__ import annotations

import logging
import re
import sys
from pathlib import Path

from app.chat.llm import QueryRewriter
from app.chat.models import ChatMessageResponse

try:
    from contexta_rag.prompts import ConversationTurn
except ModuleNotFoundError:
    rag_package_path = Path(__file__).resolve().parents[4] / "packages" / "rag"
    sys.path.append(str(rag_package_path))
    from contexta_rag.prompts import ConversationTurn

MAX_STANDALONE_WORDS = 8
MAX_REWRITE_CHARS = 300
logger = logging.getLogger(__name__)
REFERENCE_PATTERN = re.compile(
    r"(?<!\w)(?:itu|ini|terus|lalu|kemudian|dia|mereka|kalau|him|them|it|that|this|these|"
    r"those|then|same|above|they)(?!\w)",
    re.IGNORECASE,
)


def conversation_history(messages: list[ChatMessageResponse]) -> list[ConversationTurn]:
    """Recent turns only, without citations or ids.

    Called before the current question is stored, so the result never contains
    the turn being rewritten.
    """
    history: list[ConversationTurn] = []
    for message in messages:
        if message.role not in {"user", "assistant"}:
            continue
        content = message.content.strip()
        if not content:
            continue
        history.append({"role": message.role, "content": content})
    return history


def needs_rewrite(question: str, history: list[ConversationTurn]) -> tuple[bool, str]:
    """Gate: only a real follow-up is worth a second LLM call.

    Without an assistant turn there is nothing to resolve a reference against, and
    a self-contained question can only be changed, not improved, by a rewrite.
    """
    if not any(turn["role"] == "assistant" for turn in history):
        return False, "no_history"

    words = [word for word in question.split() if word.strip("?.,!;:")]
    if len(words) <= MAX_STANDALONE_WORDS or REFERENCE_PATTERN.search(question):
        return True, "followup"
    return False, "standalone"


def accept_rewrite(raw: str | None, question: str) -> tuple[str, str]:
    """Return the query to actually search with, plus why.

    The model is asked to echo the question when nothing needs resolving; that
    comes back as `unchanged` rather than a rewrite so the reason stays honest.
    """
    if not raw:
        return question, "failed"

    candidate = next((line.strip() for line in raw.splitlines() if line.strip()), "")
    if not candidate:
        return question, "failed"
    if candidate.casefold() == question.strip().casefold():
        return question, "unchanged"
    if len(candidate) > max(MAX_REWRITE_CHARS, len(question) * 2):
        return question, "too_long"
    return candidate, "applied"


def resolve_retrieval_query(
    question: str,
    history: list[ConversationTurn],
    rewriter: QueryRewriter | None,
) -> tuple[str, str]:
    """The query to search with, and why.

    A rewrite is an optimization, never a requirement: every failure path returns
    the original question so one bad completion cannot cost the user an answer.
    """
    should_rewrite, reason = needs_rewrite(question, history)
    if not should_rewrite:
        return question, reason
    if rewriter is None:
        return question, "disabled"

    try:
        raw = rewriter.rewrite_query(question, history)
    except Exception:
        logger.exception("query rewrite failed; searching the original question")
        return question, "failed"
    return accept_rewrite(raw, question)
