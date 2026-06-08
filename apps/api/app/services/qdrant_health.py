import httpx


async def check_qdrant_health(qdrant_url: str, api_key: str = "") -> dict[str, str]:
    health_url = f"{qdrant_url.rstrip('/')}/healthz"
    headers = {"api-key": api_key} if api_key else None

    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(health_url, headers=headers)
            response.raise_for_status()
    except httpx.HTTPError:
        return {"status": "unavailable", "service": "qdrant"}

    return {"status": "ok", "service": "qdrant"}
