from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import httpx


# Supabase Storage reports a missing key as HTTP 400 with the real status in the
# body ({"statusCode":"404","error":"not_found","code":"NoSuchKey"}), not as 404.
def is_missing_object(response: httpx.Response) -> bool:
    if response.status_code == 404:
        return True
    if response.status_code != 400:
        return False
    body = response.text
    return "not_found" in body or "NoSuchKey" in body
