from __future__ import annotations

import sys
from pathlib import Path
from typing import TYPE_CHECKING, Any

import httpx

try:
    from contexta_rag.vector_space import stored_vector_sizes
except ModuleNotFoundError:
    rag_package_path = Path(__file__).resolve().parents[4] / "packages" / "rag"
    sys.path.append(str(rag_package_path))
    from contexta_rag.vector_space import stored_vector_sizes

if TYPE_CHECKING:
    from contexta_rag.vector_space import VectorSpace


async def check_qdrant_health(
    qdrant_url: str,
    api_key: str = "",
    collection: str = "",
    spaces: tuple[VectorSpace, ...] = (),
) -> dict[str, Any]:
    """Report whether Qdrant answers, and what the active index really holds.

    The dimensions come from Qdrant's own collection config rather than from the
    embedding settings, because a stale `QDRANT_COLLECTION` is otherwise invisible
    until a query fails - and a frontend that hard-codes the collection name
    keeps printing the old one after every reindex. Dimensions are only ever a
    number Qdrant itself reported: until the collection read succeeds they are
    `None`, so a degraded path can never pass config values off as confirmed shape.
    """
    base_url = qdrant_url.rstrip("/")
    headers = {"api-key": api_key} if api_key else None
    status_payload: dict[str, Any] = {
        "status": "ok",
        "service": "qdrant",
        "collection": collection or None,
        "points_count": None,
        "vector_spaces": [
            {"name": space.name, "dimensions": None, "model": space.model_label}
            for space in spaces
        ],
    }

    async with httpx.AsyncClient(timeout=2.0) as client:
        try:
            health_response = await client.get(f"{base_url}/healthz", headers=headers)
            health_response.raise_for_status()
        except httpx.HTTPError:
            return {"status": "unavailable", "service": "qdrant"}

        if not collection:
            return status_payload

        try:
            info_response = await client.get(f"{base_url}/collections/{collection}", headers=headers)
        except httpx.HTTPError:
            return status_payload

        if info_response.status_code != 200:
            return status_payload

        info = info_response.json()
        stored_sizes = stored_vector_sizes(info)
        points_count = (info.get("result") or {}).get("points_count") if isinstance(info, dict) else None
        status_payload["points_count"] = points_count if isinstance(points_count, int) else None
        status_payload["vector_spaces"] = [
            {
                "name": space.name,
                "dimensions": stored_sizes.get(space.name),
                "model": space.model_label,
            }
            for space in spaces
        ]
        return status_payload
