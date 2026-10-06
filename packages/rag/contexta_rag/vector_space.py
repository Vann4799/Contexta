from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import httpx

_MISMATCH_HINT = (
    "Set QDRANT_COLLECTION to a new collection name and reindex; reading or "
    "writing the old one would mix two vector spaces."
)

_verified: set[tuple[str, int, str]] = set()


def reset_vector_space_cache() -> None:
    """Forget verified collections; tests build fake Qdrant servers per case."""
    _verified.clear()


def assert_vector_space_matches(
    client: "httpx.Client",
    qdrant_url: str,
    collection_name: str,
    dimensions: int,
    model_label: str,
    headers: dict[str, str] | None = None,
) -> bool:
    """Raise when the collection holds another embedding model's vectors.

    Returns whether the collection already exists, so callers can create it
    without a second round trip. Two models can emit the same dimension
    count, so vector size alone is not enough to tell that a reindex is overdue.
    A dependency-built retriever would otherwise re-verify on every request,
    so a verified collection is remembered for the life of the process.
    """
    base_url = f"{qdrant_url.rstrip('/')}/collections/{collection_name}"
    cache_key = (base_url, dimensions, model_label)
    if cache_key in _verified:
        return True

    info_response = client.get(base_url, headers=headers)
    if info_response.status_code == 404:
        return False
    info_response.raise_for_status()

    collection_info = info_response.json()
    stored_dimensions = _dig(collection_info, "result", "config", "params", "vectors", "size")
    if isinstance(stored_dimensions, int) and stored_dimensions != dimensions:
        raise RuntimeError(
            f"Qdrant collection '{collection_name}' stores {stored_dimensions}-dimension "
            f"vectors but the current embedding provider emits {dimensions}. {_MISMATCH_HINT}"
        )

    if model_label:
        stored_label = _stored_model_label(client, base_url, headers)
        if stored_label and stored_label != model_label:
            raise RuntimeError(
                f"Qdrant collection '{collection_name}' was indexed with '{stored_label}' "
                f"but the current embedding provider is '{model_label}'. {_MISMATCH_HINT}"
            )

    _verified.add(cache_key)
    return True


def _stored_model_label(
    client: "httpx.Client",
    base_url: str,
    headers: dict[str, str] | None,
) -> str:
    scroll_response = client.post(
        f"{base_url}/points/scroll",
        headers=headers,
        json={"limit": 1, "with_payload": ["embedding_model"]},
    )
    if scroll_response.status_code != 200:
        return ""

    points = _dig(scroll_response.json(), "result", "points")
    if not isinstance(points, list):
        return ""
    for point in points:
        label = _dig(point, "payload", "embedding_model")
        if isinstance(label, str):
            return label
    return ""


def _dig(value: Any, *keys: str) -> Any:
    for key in keys:
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value
