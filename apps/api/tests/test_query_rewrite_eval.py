from __future__ import annotations

import json
from pathlib import Path

from evals.query_rewrite_eval import load_cases, outcome
from evals.retrieval_eval import DEFAULT_CASES as RETRIEVAL_CASES

CASES_FILE = Path(__file__).resolve().parents[1] / "evals" / "query_rewrite_cases.json"


def _grade(rank: int | None) -> dict[str, object]:
    return {"first_hit_rank": rank}


def test_outcome_compares_hit_ranks_not_scores() -> None:
    assert outcome(_grade(None), _grade(2)) == "better"
    assert outcome(_grade(3), _grade(1)) == "better"
    assert outcome(_grade(2), _grade(2)) == "same"
    assert outcome(_grade(1), _grade(None)) == "worse"
    assert outcome(_grade(2), _grade(4)) == "worse"
    assert outcome(_grade(None), _grade(None)) == "same"


def test_cases_map_gold_keys_onto_live_document_ids() -> None:
    user_id, cases = load_cases(CASES_FILE, None)
    payload = json.loads(CASES_FILE.read_text(encoding="utf-8"))

    assert user_id == payload["user_id"]
    assert len(cases) == len(payload["cases"])

    by_id = {case["id"]: case for case in cases}
    follow_ups = [case for case in cases if case["expect_rewrite"]]

    assert len(follow_ups) >= 10
    for case in follow_ups:
        assert case["history"], case["id"]
        assert any(turn["role"] == "assistant" for turn in case["history"]), case["id"]

    assert by_id["ctl-no-history"]["history"] == []
    assert by_id["ctl-self-contained-question"]["expect_rewrite"] is False


def test_rewritten_cases_reuse_labels_from_the_single_turn_baseline() -> None:
    """A follow-up case must gold-label the same chunk as the case it came from.

    The rewritten wording has no ground truth of its own; the only honest label
    is the one already measured against the live corpus dump.
    """
    _, baseline = load_cases(RETRIEVAL_CASES, None)
    baseline_by_id = {case["id"]: case for case in baseline}
    _, cases = load_cases(CASES_FILE, None)

    for case in cases:
        if not case["source_case"]:
            continue
        source = baseline_by_id[case["source_case"]]
        assert case["gold"] == source["gold"], case["id"]
