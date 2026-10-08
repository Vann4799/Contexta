import asyncio
from time import perf_counter

from fastapi import FastAPI, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from app.account.routes import router as account_router
from app.apikeys.dependencies import finalize_api_request_log
from app.apikeys.routes import router as api_keys_router
from app.chat.retrieval import configured_vector_spaces
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
    # A cross-origin client only sees what is exposed here. /v1 reports its quota on every
    # allowed response and Retry-After on every 429; without these names a browser-side
    # integrator cannot back off before it hits the limit.
    expose_headers=[
        "Content-Disposition",
        "X-RateLimit-Limit-Minute",
        "X-RateLimit-Remaining-Minute",
        "X-RateLimit-Limit-Day",
        "X-RateLimit-Remaining-Day",
        "Retry-After",
    ],
)
app.include_router(account_router)
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


CLIENT_CLOSED_REQUEST = 499  # nginx's non-standard status for "client closed request"


@app.middleware("http")
async def finalize_v1_audit_log(request: Request, call_next):
    """Record the status the caller actually received, not just the admission decision.

    The authorize RPC writes the audit row before the route body runs, so on its own it can
    only ever report the authorization outcome. This is the first point after routing where
    the final status exists.
    """
    if not request.url.path.startswith("/v1/"):
        return await call_next(request)

    try:
        response = await call_next(request)
    except asyncio.CancelledError:
        # The caller hung up mid-request, which is not an exception Exception catches.
        # 499 is nginx's "client closed request". This one stays a direct call on purpose:
        # the cancel scope is already unwinding, so a further await would be cancelled
        # before the write leaves.
        finalize_api_request_log(request, CLIENT_CLOSED_REQUEST)
        raise
    except Exception:
        await run_in_threadpool(finalize_api_request_log, request, status.HTTP_500_INTERNAL_SERVER_ERROR)
        raise

    await run_in_threadpool(finalize_api_request_log, request, response.status_code)
    return response


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "contexta-api"}


@app.get("/health/vector")
async def vector_health(response: Response) -> dict[str, object]:
    settings = get_settings()
    health_status = await check_qdrant_health(
        settings.qdrant_url,
        settings.qdrant_api_key,
        collection=settings.qdrant_collection,
        spaces=configured_vector_spaces(settings),
    )

    if health_status["status"] == "unavailable":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return health_status


@app.get("/health/indexing")
def indexing_health() -> IndexingHealthResponse:
    # Sync on purpose: the check blocks on httpx, and inside async def it would freeze
    # the event loop for every concurrent request, not just this one.
    return check_indexing_health(get_settings())
