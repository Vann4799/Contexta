import importlib.util
import json
from pathlib import Path

EVALS_DIR = Path(__file__).resolve().parents[1] / "evals"

spec = importlib.util.spec_from_file_location("retrieval_eval", EVALS_DIR / "retrieval_eval.py")
retrieval_eval = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retrieval_eval)


def point(document_id: str, chunk_index: int, text: str = "meaningful chunk text that is long enough") -> dict:
    return {
        "document_id": document_id,
        "document_name": "doc.pdf",
        "chunk_index": chunk_index,
        "page_number": chunk_index + 1,
        "text": text,
        "score": 0.9,
    }


def test_cases_file_resolves_every_gold_document() -> None:
    payload = json.loads((EVALS_DIR / "retrieval_cases.json").read_text(encoding="utf-8"))
    documents = payload["documents"]
    user_id, cases = retrieval_eval.load_cases(EVALS_DIR / "retrieval_cases.json", None)

    assert user_id == payload["user_id"]
    assert len(cases) >= 15
    assert len({case["id"] for case in cases}) == len(cases)

    for case in cases:
        assert case["question"].strip()
        for entry in case["gold"]:
            assert entry["document_key"] in documents
            assert entry["document_id"] == documents[entry["document_key"]]
            assert entry["chunk_indices"], case["id"]


def test_grade_case_counts_hit_rank_and_junk() -> None:
    gold = [{"document_id": "doc-a", "document_key": "a", "chunk_indices": [7, 8]}]
    results = [
        point("doc-b", 1),
        point("doc-a", 4, "  "),
        point("doc-a", 8),
    ]

    grades = retrieval_eval.grade_case(results, gold)

    assert grades["first_hit_rank"] == 3
    assert grades["hit_at"]["hit@1"] is False
    assert grades["hit_at"]["hit@3"] is True
    assert grades["doc_hit@5"] is True
    assert grades["junk_in_top5"] == 1
    assert grades["reciprocal_rank"] == 1 / 3


def test_grade_case_without_any_gold_document_misses() -> None:
    gold = [{"document_id": "doc-a", "document_key": "a", "chunk_indices": [2]}]

    grades = retrieval_eval.grade_case([point("doc-z", 2)], gold)

    assert grades["first_hit_rank"] is None
    assert grades["hit_at"] == {"hit@1": False, "hit@3": False, "hit@5": False}
    assert grades["doc_hit@5"] is False
    assert grades["reciprocal_rank"] == 0.0


def test_summarise_averages_over_cases() -> None:
    def graded(hit_rank: int | None) -> dict:
        return {
            "grades": {
                "hit_at": {f"hit@{k}": hit_rank is not None and hit_rank <= k for k in (1, 3, 5)},
                "doc_hit@5": hit_rank is not None,
                "reciprocal_rank": 1 / hit_rank if hit_rank else 0.0,
                "junk_in_top5": 1 if hit_rank is None else 0,
                "returned": [],
            }
        }

    summary = retrieval_eval.summarise([graded(1), graded(None)])

    assert summary == {
        "cases": 2,
        "hit@1": 0.5,
        "hit@3": 0.5,
        "hit@5": 0.5,
        "doc_hit@5": 0.5,
        "mrr@5": 0.5,
        "mean_junk_in_top5": 0.5,
    }


def test_compare_flags_dropped_hit_rate_and_extra_junk(tmp_path: Path) -> None:
    baseline = {
        "metrics": {"hit@1": 0.6, "hit@5": 0.9, "mrr@5": 0.7, "mean_junk_in_top5": 0.2}
    }
    baseline_path = tmp_path / "baseline.json"
    baseline_path.write_text(json.dumps(baseline), encoding="utf-8")

    worse = {
        "metrics": {"hit@1": 0.5, "hit@5": 0.95, "mrr@5": 0.7, "mean_junk_in_top5": 0.4}
    }
    regressions = retrieval_eval.compare(worse, baseline_path)

    assert regressions == ["hit@1: 0.6 -> 0.5", "mean_junk_in_top5: 0.2 -> 0.4 (more junk)"]
    assert retrieval_eval.compare(baseline, baseline_path) == []
