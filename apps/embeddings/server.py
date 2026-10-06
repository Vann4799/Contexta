from __future__ import annotations

import json
import os
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DEFAULT_MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
DEFAULT_PORT = 8070
MAX_TEXTS_PER_REQUEST = 256
MAX_CHARS_PER_TEXT = 8000


class EmbeddingService:
    def __init__(self, model_name: str) -> None:
        try:
            from sentence_transformers import SentenceTransformer
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "sentence-transformers is not installed in this image"
            ) from exc

        self.model_name = model_name
        self._model = SentenceTransformer(model_name, device="cpu")
        self._lock = threading.Lock()
        self.dimensions = len(self._encode(["warmup"])[0])

    def embed(self, texts: list[str]) -> list[list[float]]:
        with self._lock:
            return self._encode(texts)

    def _encode(self, texts: list[str]) -> list[list[float]]:
        encoded = self._model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return [[float(value) for value in vector] for vector in encoded]


class EmbeddingRequestHandler(BaseHTTPRequestHandler):
    service: EmbeddingService

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler contract
        if self.path.rstrip("/") != "/health":
            self._respond(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return
        self._respond(
            HTTPStatus.OK,
            {
                "status": "ok",
                "model": self.service.model_name,
                "dimensions": self.service.dimensions,
            },
        )

    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler contract
        if self.path.rstrip("/") != "/embed":
            self._respond(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return

        payload = self._read_json()
        if payload is None:
            return

        texts = payload.get("texts")
        if not isinstance(texts, list) or not all(isinstance(t, str) for t in texts):
            self._respond(
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {"error": 'body must be {"texts": ["..."]}'},
            )
            return
        if len(texts) > MAX_TEXTS_PER_REQUEST:
            self._respond(
                HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
                {"error": f"at most {MAX_TEXTS_PER_REQUEST} texts per request"},
            )
            return

        try:
            vectors = self.service.embed([text[:MAX_CHARS_PER_TEXT] for text in texts])
        except Exception as exc:  # surfaced to the caller, never a bare hang
            self._respond(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(exc)})
            return

        self._respond(
            HTTPStatus.OK,
            {
                "model": self.service.model_name,
                "dimensions": self.service.dimensions,
                "vectors": vectors,
            },
        )

    def log_message(self, format: str, *args: object) -> None:
        return

    def _read_json(self) -> dict[str, object] | None:
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b""
            payload = json.loads(raw or b"{}")
            if not isinstance(payload, dict):
                raise TypeError("body must be an object")
            return payload
        except (ValueError, TypeError) as exc:
            self._respond(HTTPStatus.UNPROCESSABLE_ENTITY, {"error": str(exc)})
            return None

    def _respond(self, status: HTTPStatus, body: dict[str, object]) -> None:
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def main() -> None:
    model_name = os.environ.get("EMBEDDING_MODEL_NAME") or DEFAULT_MODEL_NAME
    port = int(os.environ.get("PORT") or DEFAULT_PORT)

    service = EmbeddingService(model_name)
    EmbeddingRequestHandler.service = service
    print(f"embeddings ready model={model_name} dimensions={service.dimensions}")

    ThreadingHTTPServer(("0.0.0.0", port), EmbeddingRequestHandler).serve_forever()


if __name__ == "__main__":
    main()
