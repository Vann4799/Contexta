from time import perf_counter

from fastapi import FastAPI, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.apikeys.routes import router as api_keys_router
from app.chat.routes import router as chat_router
from app.convert.routes import router as convert_router
from app.core.config import get_settings
from app.documents.routes import router as documents_router
from app.export.routes import router as export_router
from app.services.indexing_health import IndexingHealthResponse, check_indexing_health
from app.services.qdrant_health import check_qdrant_health
from app.v1.routes import router as v1_router
from app.v1.routes import v1_aware_validation_error


app = FastAPI(title="Contexta API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)
app.include_router(documents_router)
app.include_router(chat_router)
app.include_router(convert_router)
app.include_router(export_router)
app.include_router(api_keys_router)
app.include_router(v1_router)
app.add_exception_handler(RequestValidationError, v1_aware_validation_error)


@app.middleware("http")
async def stamp_request_start(request: Request, call_next):
    # The /v1 audit log records latency for the whole request, including the authorize
    # round trip, so the clock starts before any dependency runs.
    request.state.started_at = perf_counter()
    return await call_next(request)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "contexta-api"}


@app.get("/health/vector")
async def vector_health(response: Response) -> dict[str, str]:
    settings = get_settings()
    health_status = await check_qdrant_health(settings.qdrant_url, settings.qdrant_api_key)

    if health_status["status"] == "unavailable":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return health_status


@app.get("/health/indexing")
async def indexing_health() -> IndexingHealthResponse:
    return check_indexing_health(get_settings())
