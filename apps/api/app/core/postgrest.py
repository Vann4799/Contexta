from __future__ import annotations


def first_row(payload: object, resource: str) -> dict[str, object]:
    """PostgREST answers `Prefer: return=representation` inserts with a list; an
    empty list means no row came back, and indexing it raises a bare IndexError."""
    if isinstance(payload, list):
        if not payload:
            raise RuntimeError(f"Supabase returned no row for the inserted {resource}")
        payload = payload[0]
    if not isinstance(payload, dict):
        raise RuntimeError(
            f"Supabase returned an unexpected payload for the inserted {resource}"
        )
    return payload
