"""Retrieval eval harness: measures hit-rate of the production Qdrant path.

Run from apps/api on a host that can reach Qdrant with the same env as the API:

    python evals/retrieval_eval.py --out evals/results/baseline.json
    python evals/retrieval_eval.py --compare evals/results/baseline.json

Gold labels live in evals/retrieval_cases.json. A case hits when a returned
point matches both the gold document and one of its gold chunk indices.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))
for _parent in API_ROOT.parents:
    _rag_package = _parent / "packages" / "rag"
    if _rag_package.is_dir():
        sys.path.append(str(_rag_package))
        break

from app.chat.retrieval import QdrantRetriever  # noqa: E402
from app.core.config import Settings, get_settings  # noqa: E402
from contexta_rag.embeddings import create_embedding_provider, embedding_model_label  # noqa: E402

DEFAULT_CASES = API_ROOT / "evals" / "retrieval_cases.json"
JUNK_TEXT_CHARS = 40
KS = (1, 3, 5)


def build_retriever(settings: Settings) -> QdrantRetriever:
    return QdrantRetriever(
        qdrant_url=settings.qdrant_url,
        collection_name=settings.qdrant_collection,
        embedding_provider=create_embedding_provider(
            provider_name=settings.embedding_provider,
            dimensions=settings.embedding_dimensions,
            model_name=settings.embedding_model_name,
            device=settings.embedding_device or None,
            remote_url=settings.embedding_remote_url,
            base_url=settings.embedding_base_url,
            api_key=settings.embedding_api_key,
        ),
        api_key=settings.qdrant_api_key,
        expected_dimensions=settings.embedding_dimensions,
        expected_model_label=embedding_model_label(
            settings.embedding_provider,
            settings.embedding_model_name,
        ),
    )


def grade_case(results: list[dict[str, Any]], gold: list[dict[str, Any]]) -> dict[str, Any]:
    wanted = {
        entry["document_id"]: set(entry["chunk_indices"]) for entry in gold
    }

    ranks = [
        index
        for index, point in enumerate(results, start=1)
        if point["chunk_index"] in wanted.get(point["document_id"], set())
    ]
    doc_ids = {entry["document_id"] for entry in gold}

    return {
        "hit_at": {
            f"hit@{k}": any(rank <= k for rank in ranks[:1]) for k in KS
        },
        "doc_hit@5": any(point["document_id"] in doc_ids for point in results[:5]),
        "reciprocal_rank": 1.0 / ranks[0] if ranks else 0.0,
        "first_hit_rank": ranks[0] if ranks else None,
        "junk_in_top5": sum(
            1
            for point in results[:5]
            if len(point["text"].strip()) < JUNK_TEXT_CHARS
        ),
        "returned": [
            {
                "document": point["document_id"],
                "chunk": point["chunk_index"],
                "score": round(point["score"], 4),
            }
            for point in results[:5]
        ],
    }


def summarise(cases: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(cases)
    metrics = {
        f"hit@{k}": round(
            sum(1 for case in cases if case["grades"]["hit_at"][f"hit@{k}"]) / total, 4
        )
        for k in KS
    }
    metrics["doc_hit@5"] = round(
        sum(1 for case in cases if case["grades"]["doc_hit@5"]) / total, 4
    )
    metrics["mrr@5"] = round(
        sum(case["grades"]["reciprocal_rank"] for case in cases) / total, 4
    )
    metrics["mean_junk_in_top5"] = round(
        sum(case["grades"]["junk_in_top5"] for case in cases) / total, 4
    )
    return {"cases": total, **metrics}


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


def compare(current: dict[str, Any], baseline_path: Path) -> list[str]:
    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))["metrics"]
    regressions = []

    for metric, value in current["metrics"].items():
        previous = baseline.get(metric)
        if previous is None:
            continue
        if metric == "mean_junk_in_top5":
            if value > previous:
                regressions.append(f"{metric}: {previous} -> {value} (more junk)")
            continue
        if value < previous:
            regressions.append(f"{metric}: {previous} -> {value}")
    return regressions


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--user-id", default=None)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--compare", type=Path, default=None)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    settings = get_settings()
    user_id, cases = load_cases(args.cases, args.user_id)
    if args.limit:
        cases = cases[: args.limit]

    retriever = build_retriever(settings)
    print(
        f"provider={settings.embedding_provider} model={settings.embedding_model_name} "
        f"collection={settings.qdrant_collection} top_k={args.top_k}"
    )

    for case in cases:
        try:
            results = retriever.retrieve(user_id, case["question"], top_k=args.top_k)
        except httpx.ConnectError as exc:
            print(f"\nQdrant is not reachable at {settings.qdrant_url}: {exc}")
            print("Run this on the host that serves the API.")
            return 2
        case["grades"] = grade_case(results, case["gold"])
        hit = case["grades"]["first_hit_rank"]
        marker = f"hit@{hit}" if hit else "MISS"
        print(f"{case['id']:<26} {marker:<8} junk={case['grades']['junk_in_top5']}")
        if args.verbose:
            for point in case["grades"]["returned"]:
                print(f"    {point['document'][:8]} #{point['chunk']:<4} {point['score']}")

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "embedding_provider": settings.embedding_provider,
        "embedding_model": settings.embedding_model_name,
        "collection": settings.qdrant_collection,
        "top_k": args.top_k,
        "cases_file": str(args.cases),
        "metrics": summarise(cases),
        "per_case": {case["id"]: case["grades"] for case in cases},
    }

    print("\n" + json.dumps(report["metrics"], indent=2))

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"wrote {args.out}")

    if args.compare:
        regressions = compare(report, args.compare)
        if regressions:
            print("\nREGRESSION vs " + str(args.compare))
            for line in regressions:
                print("  " + line)
            return 1
        print(f"\nno regression vs {args.compare}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
