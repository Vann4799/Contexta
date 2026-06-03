import httpx


async def check_qdrant_health(qdrant_url: str) -> dict[str, str]:
    health_url = f"{qdrant_url.rstrip('/')}/healthz"

    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            await client.get(health_url)
    except httpx.HTTPError:
        return {"status": "unavailable", "service": "qdrant"}

    return {"status": "ok", "service": "qdrant"}
