from __future__ import annotations


def reciprocal_rank_fusion(ranked_keys: list[list[str]], k: int = 60) -> dict[str, float]:
    """Merge per-arm rankings into one score per key.

    Only the position of a key inside its own arm counts, so arms whose cosine
    scales disagree (a 384-dim local model and a 1536-dim hosted one do) cannot
    outvote each other by score magnitude. Ties keep the order the arms were
    passed in, which makes the merged list reproducible across runs.
    """
    scores: dict[str, float] = {}
    for keys in ranked_keys:
        for rank, key in enumerate(keys):
            scores[key] = scores.get(key, 0.0) + 1.0 / (k + rank + 1)
    return scores


def order_by_fusion(scores: dict[str, float]) -> list[str]:
    return sorted(scores, key=lambda key: -scores[key])
