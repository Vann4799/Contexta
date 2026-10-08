from __future__ import annotations

from uuid import UUID


def is_uuid(value: str) -> bool:
    """True when a client-supplied id could name a row at all.

    Every id column in this schema is a Postgres `uuid`, so a non-uuid value is not
    a lookup that misses: PostgREST refuses to build the filter with HTTP 400, and a
    repository that only calls `raise_for_status()` turns that into a 500 for the
    client. Answering "no such row" is what the database would have said.
    """
    try:
        UUID(value)
    except (ValueError, AttributeError):
        return False
    return True
