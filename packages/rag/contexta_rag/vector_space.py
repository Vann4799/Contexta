from __future__ import annotations

from typing import TYPE_CHECKING, Any, NamedTuple

if TYPE_CHECKING:
    import httpx

_MISMATCH_HINT = (
    "Set QDRANT_COLLECTION to a new collection name and reindex; reading or "
    "writing the old one would mix two vector spaces."
)

_verified: set[tuple[str, tuple[tuple[str, int, str], ...]]] = set()


class VectorSpace(NamedTuple):
    """One embedding arm: the Qdrant vector slot it writes, its size and its model."""

    name: str
    dimensions: int
    model_label: str


def reset_vector_space_cache() -> None:
    """Forget verified collections; tests build fake Qdrant servers per case."""
    _verified.clear()


def assert_vector_spaces_match(
    client: "httpx.Client",
    qdrant_url: str,
    collection_name: str,
    spaces: list[VectorSpace],
    headers: dict[str, str] | None = None,
) -> bool:
    """Raise when any named vector slot disagrees with the arm that writes it.

    Two models can emit the same dimension count, so vector size alone is not
    enough to tell that a reindex is overdue. A dependency-built retriever would
    otherwise re-verify on every request, so a verified collection is remembered
    for the life of the process.
    """
    base_url = f"{qdrant_url.rstrip('/')}/collections/{collection_name}"
    cache_key = (base_url, tuple(sorted((s.name, s.dimensions, s.model_label) for s in spaces)))
    if cache_key in _verified:
        return True

    info_response = client.get(base_url, headers=headers)
    if info_response.status_code == 404:
        return False
    info_response.raise_for_status()

    collection_info = info_response.json()
    stored_sizes = _stored_sizes(_dig(collection_info, "result", "config", "params", "vectors"))
    if not stored_sizes:
        # An unrecognisable collection shape must not be reported as a mismatch.
        return True
    for space in spaces:
        stored_dimensions = stored_sizes.get(space.name)
        if stored_dimensions is None:
            raise RuntimeError(
                f"Qdrant collection '{collection_name}' has no vector slot "
                f"'{space.name or 'default'}' ({space.dimensions}-dim from "
                f"'{space.model_label}'). {_MISMATCH_HINT}"
            )
        if stored_dimensions != space.dimensions:
            raise RuntimeError(
                f"Qdrant collection '{collection_name}' stores "
                f"{stored_dimensions}-dimension vectors in slot "
                f"'{space.name or 'default'}' but the current embedding provider "
                f"emits {space.dimensions}. {_MISMATCH_HINT}"
            )

    stored_labels = (
        _stored_model_labels(client, base_url, headers)
        if any(space.model_label for space in spaces)
        else {}
    )
    for space in spaces:
        expected = space.model_label
        if not expected:
            continue
        stored_label = stored_labels.get(space.name) or (
            stored_labels.get("") if len(spaces) == 1 else None
        )
        if stored_label and stored_label != expected:
            raise RuntimeError(
                f"Qdrant collection '{collection_name}' was {_slot_phrase(space)}"
                f"with '{stored_label}' but the current embedding provider is "
                f"'{expected}'. {_MISMATCH_HINT}"
            )

    _verified.add(cache_key)
    return True


def _slot_phrase(space: VectorSpace) -> str:
    return "indexed " if not space.name else f"indexed in slot '{space.name}' "


def _stored_sizes(vectors_config: Any) -> dict[str, int]:
    """Map every vector slot of a collection to its size.

    A single unnamed vector is reported by Qdrant as a bare object with `size`,
    while named vectors become an object keyed by vector name.
    """
    if not isinstance(vectors_config, dict):
        return {}
    if "size" in vectors_config:
        size = vectors_config["size"]
        return {"": size} if isinstance(size, int) else {}
    return {
        name: config["size"]
        for name, config in vectors_config.items()
        if isinstance(config, dict) and isinstance(config.get("size"), int)
    }


def _stored_model_labels(
    client: "httpx.Client",
    base_url: str,
    headers: dict[str, str] | None,
) -> dict[str, str]:
    """Read the embedding model of each slot from one sampled point.

    Older collections store a single `embedding_model` string; collections with
    more than one arm store `embedding_models` keyed by vector slot name.
    """
    scroll_response = client.post(
        f"{base_url}/points/scroll",
        headers=headers,
        json={"limit": 1, "with_payload": ["embedding_model", "embedding_models"]},
    )
    if scroll_response.status_code != 200:
        return {}

    points = _dig(scroll_response.json(), "result", "points")
    if not isinstance(points, list):
        return {}
    for point in points:
        payload = point.get("payload") if isinstance(point, dict) else None
        if not isinstance(payload, dict):
            continue
        labels = payload.get("embedding_models")
        if isinstance(labels, dict):
            return {
                name: label
                for name, label in labels.items()
                if isinstance(label, str) and isinstance(name, str)
            }
        single = payload.get("embedding_model")
        if isinstance(single, str):
            return {"": single}
    return {}


def _dig(value: Any, *keys: str) -> Any:
    for key in keys:
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value
