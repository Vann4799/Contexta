import json
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

import server

MAX_TEXTS = server.MAX_TEXTS_PER_REQUEST


class FakeService:
    model_name = "fake-model"
    dimensions = 3

    def __init__(self) -> None:
        self.batches: list[list[str]] = []

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.batches.append(list(texts))
        return [[float(len(text)), 0.0, 1.0] for text in texts]


@pytest.fixture
def service_server():
    service = FakeService()
    server.EmbeddingRequestHandler.service = service
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.EmbeddingRequestHandler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()

    yield f"http://127.0.0.1:{httpd.server_address[1]}", service

    httpd.shutdown()
    httpd.server_close()


def _get(url: str) -> tuple[int, dict]:
    try:
        with urllib.request.urlopen(url) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read())


def _embed(base_url: str, payload: object) -> tuple[int, dict]:
    request = urllib.request.Request(
        f"{base_url}/embed",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read())


def test_health_reports_the_loaded_model(service_server) -> None:
    base_url, _ = service_server

    status, body = _get(f"{base_url}/health")

    assert status == 200
    assert body == {"status": "ok", "model": "fake-model", "dimensions": 3}


def test_embed_returns_one_vector_per_text(service_server) -> None:
    base_url, service = service_server

    status, body = _embed(base_url, {"texts": ["halo", "dunia"]})

    assert status == 200
    assert body["vectors"] == [[4.0, 0.0, 1.0], [5.0, 0.0, 1.0]]
    assert body["dimensions"] == 3
    assert service.batches == [["halo", "dunia"]]


def test_embed_rejects_a_body_without_texts(service_server) -> None:
    base_url, _ = service_server

    status, body = _embed(base_url, {"texts": "not a list"})

    assert status == 422
    assert "texts" in body["error"]


def test_embed_rejects_an_oversized_batch(service_server) -> None:
    base_url, service = service_server

    status, _ = _embed(base_url, {"texts": ["kata"] * (MAX_TEXTS + 1)})

    assert status == 413
    assert service.batches == []


def test_unknown_paths_are_not_found(service_server) -> None:
    base_url, _ = service_server

    assert _get(f"{base_url}/metrics")[0] == 404
    request = urllib.request.Request(
        f"{base_url}/unknown", data=b"{}", headers={"Content-Type": "application/json"}
    )
    with pytest.raises(urllib.error.HTTPError) as caught:
        urllib.request.urlopen(request)
    assert caught.value.code == 404


def test_embed_answers_an_empty_batch_without_calling_the_model(service_server) -> None:
    base_url, service = service_server

    status, body = _embed(base_url, {"texts": []})

    assert status == 200
    assert body["vectors"] == []
    assert service.batches == [[]]
