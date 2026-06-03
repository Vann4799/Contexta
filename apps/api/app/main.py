from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.documents.routes import router as documents_router
from app.services.qdrant_health import check_qdrant_health


app = FastAPI(title="Contexta API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(documents_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "contexta-api"}


@app.get("/health/vector")
async def vector_health(response: Response) -> dict[str, str]:
    settings = get_settings()
    health_status = await check_qdrant_health(settings.qdrant_url)

    if health_status["status"] == "unavailable":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return health_status
