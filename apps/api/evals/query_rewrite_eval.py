"""A/B harness for T5: does a rewritten follow-up actually retrieve better?

Same retriever, same gold labels, two queries per case: the raw follow-up and
the query `resolve_retrieval_query()` picks for production. A rewrite only
earns its latency if the second row beats the first, so both rows always print
and any case that gets worse is listed explicitly.

Run from apps/api on the host that can reach Qdrant and DeepSeek:

    python evals/query_rewrite_eval.py --verbose
    python evals/query_rewrite_eval.py --out evals/results/query_rewrite.json

Gold chunk indices are copied from retrieval_cases.json, so a target chunk here
is a chunk already labelled against the live corpus dump.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from evals.retrieval_eval import (  # noqa: E402
    arm_descriptions,
    build_retriever,
    grade_case,
    summarise,
)

from app.chat.rewrite import resolve_retrieval_query  # noqa: E402
from app.chat.routes import get_query_rewriter  # noqa: E402
from app.core.config import get_settings  # noqa: E402

DEFAULT_CASES = API_ROOT / "evals" / "query_rewrite_cases.json"


def load_cases(path: Path, user_id: str | None) -> tuple[str, list[dict[str, Any]]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    documents = payload["documents"]
    resolved_user = user_id or payload["user_id"]
    cases = []

    for case in payload["cases"]:
        cases.append(
            {
                "id": case["id"],
                "question": case["question"],
                "history": case.get("history", []),
                "expect_rewrite": case.get("expect_rewrite", True),
                "source_case": case.get("source_case", ""),
                "note": case.get("note", ""),
                "gold": [
                    {
                        "document_id": documents[entry["document"]],
                        "document_key": entry["document"],
                        "chunk_indices": entry["chunks"],
                    }
                    for entry in case["gold"]
                ],
            }
        )
    return resolved_user, cases


def outcome(raw_grade: dict[str, Any], rewritten_grade: dict[str, Any]) -> str:
    """Did the rewrite move this case, holding the gold label fixed?

    A miss ranks below every hit, so two misses compare equal.
    """
    before = raw_grade["first_hit_rank"] or float("inf")
    after = rewritten_grade["first_hit_rank"] or float("inf")

    if after < before:
        return "better"
    if after > before:
        return "worse"
    return "same"


def describe(case: dict[str, Any], verdict: str, latency_ms: int) -> str:
    marker = {
        "better": "BETTER",
        "worse": "WORSE ",
        "same": "same  ",
    }.get(verdict, verdict)
    return f"{case['id']:<28} {marker} {latency_ms:>5}ms"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--user-id", default=None)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument(
        "--arm-window",
        type=int,
        default=None,
        help="Candidates each arm asks Qdrant for before fusion (default: RETRIEVAL_ARM_WINDOW)",
    )
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    settings = get_settings()
    user_id, cases = load_cases(args.cases, args.user_id)
    if args.limit:
        cases = cases[: args.limit]

    arm_window = (
        args.arm_window
        if args.arm_window is not None
        else settings.retrieval_arm_window
    )
    retriever = build_retriever(settings, arm_window)
    rewriter = get_query_rewriter(settings)
    arms = arm_descriptions(settings)

    print(
        "arms="
        + " + ".join(f"{arm['slot']}:{arm['model']}" for arm in arms)
        + f" collection={settings.qdrant_collection}"
        + f" top_k={args.top_k} arm_window={arm_window}"
        + f" rewrite={'on:' + settings.deepseek_rewrite_model if rewriter else 'off'}"
    )
    if rewriter is None:
        print(
            "REWRITE KILL SWITCH IS ON - every case falls back to the raw question, "
            "so both rows will be identical."
        )

    rows: list[dict[str, Any]] = []
    gate_mismatches: list[str] = []

    for case in cases:
        started = time.perf_counter()
        query, reason = resolve_retrieval_query(
            case["question"], case["history"], rewriter
        )
        latency_ms = int((time.perf_counter() - started) * 1000)

        rewrote = reason == "applied"
        if rewrote != case["expect_rewrite"]:
            gate_mismatches.append(
                f"{case['id']}: expected rewrite={case['expect_rewrite']}, got '{reason}'"
            )

        try:
            raw_results = retriever.retrieve(
                user_id, case["question"], top_k=args.top_k
            )
            # Without an applied rewrite both rows are the same query, so reuse
            # the first result set instead of paying for a second embedding.
            ab_results = raw_results
            if rewrote:
                ab_results = retriever.retrieve(user_id, query, top_k=args.top_k)
        except httpx.ConnectError as exc:
            print(f"\nQdrant is not reachable at {settings.qdrant_url}: {exc}")
            print("Run this on the host that serves the API.")
            return 2

        raw_grade = grade_case(raw_results, case["gold"])
        ab_grade = grade_case(ab_results, case["gold"])
        verdict = outcome(raw_grade, ab_grade)

        rows.append(
            {
                "id": case["id"],
                "question": case["question"],
                "history_turns": len(case["history"]),
                "expect_rewrite": case["expect_rewrite"],
                "retrieval_query": query,
                "rewrite": reason,
                "rewrite_ms": latency_ms,
                "raw_hit_rank": raw_grade["first_hit_rank"],
                "ab_hit_rank": ab_grade["first_hit_rank"],
                "verdict": verdict,
                "raw": raw_grade,
                "ab": ab_grade,
            }
        )

        print(
            f"{describe(case, verdict, latency_ms)}  {reason:<10} "
            f"raw={_rank(raw_grade['first_hit_rank'])} -> ab={_rank(ab_grade['first_hit_rank'])}"
        )
        if args.verbose:
            print(f"    query: {query}")
            if rewrote:
                print(f"    raw:   {case['question']}")
            for point in ab_grade["returned"]:
                print(f"      {point['document'][:8]} #{point['chunk']:<4} {point['score']}")

    raw_cases = [{"grades": row["raw"]} for row in rows]
    ab_cases = [{"grades": row["ab"]} for row in rows]
    raw_metrics = summarise(raw_cases)
    ab_metrics = summarise(ab_cases)
    rewritten = [row for row in rows if row["rewrite"] == "applied"]
    worse = [row for row in rows if row["verdict"] == "worse"]
    better = [row for row in rows if row["verdict"] == "better"]
    latencies = sorted(row["rewrite_ms"] for row in rewritten)

    print("\nraw question   " + json.dumps(raw_metrics, indent=2))
    print("\nwith rewrite   " + json.dumps(ab_metrics, indent=2))
    print(
        f"\nrewritten={len(rewritten)}/{len(rows)} "
        f"better={len(better)} worse={len(worse)}"
    )
    if latencies:
        print(
            f"rewrite latency ms: median={latencies[len(latencies) // 2]} "
            f"max={latencies[-1]}"
        )

    if worse:
        print("\nREGRESSIONS - the rewrite lost a hit these cases had:")
        for row in worse:
            print(
                f"  {row['id']}: {_rank(row['raw_hit_rank'])} -> "
                f"{_rank(row['ab_hit_rank'])}"
            )
            print(f"    query: {row['retrieval_query']}")

    if gate_mismatches:
        print("\nGATE MISMATCHES:")
        for line in gate_mismatches:
            print("  " + line)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "cases_file": str(args.cases),
        "collection": settings.qdrant_collection,
        "embedding_arms": arms,
        "top_k": args.top_k,
        "arm_window": arm_window,
        "rewrite_model": settings.deepseek_rewrite_model,
        "rewrite_enabled": rewriter is not None,
        "metrics_raw": raw_metrics,
        "metrics_rewritten": ab_metrics,
        "rewritten_count": len(rewritten),
        "better": [row["id"] for row in better],
        "worse": [row["id"] for row in worse],
        "gate_mismatches": gate_mismatches,
        "per_case": rows,
    }

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"wrote {args.out}")

    return 1 if (worse or gate_mismatches) else 0


def _rank(value: int | None) -> str:
    return str(value) if value else "MISS"


if __name__ == "__main__":
    raise SystemExit(main())
