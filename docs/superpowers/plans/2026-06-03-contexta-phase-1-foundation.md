# Contexta Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runnable Contexta foundation: monorepo structure, local Qdrant Docker config, FastAPI API skeleton, worker skeleton, shared Python RAG utilities, and a polished Next.js app shell.

**Architecture:** This phase creates the project boundaries defined in the approved design spec without implementing the full upload/chat pipeline yet. The API and worker are separate Python apps sharing focused RAG utility modules. The web app is a Next.js shell branded as Contexta with routes ready for auth, dashboard, documents, chat, and settings.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, FastAPI, Pytest, Python 3.11+, Qdrant Docker, Supabase environment placeholders.

---

## Scope

This plan intentionally implements Phase 1 only. It prepares the repo for later Supabase schema, document upload, BGE-M3 embedding, Qdrant indexing, and DeepSeek chat implementation.

Phase 1 includes:

- Monorepo directories.
- Root documentation and env examples.
- Qdrant Docker Compose service.
- FastAPI `/health` and `/health/vector` endpoints.
- Worker loop skeleton with a testable polling boundary.
- Shared chunking utility with tests.
- Shared prompt builder with tests.
- Next.js Contexta app shell with logo and core pages.

Phase 1 does not include:

- Real Supabase Auth implementation.
- Real file upload.
- Real BGE-M3 model loading.
- Real DeepSeek API calls.
- Real Qdrant vector upserts/search.

Those are implemented in later plans after this foundation is running.

## Planned File Structure

Create:

- `.env.example`: root environment variable reference for all services.
- `.gitignore`: ignores Python, Node, env, build, and model cache artifacts.
- `README.md`: local development commands and service overview.
- `docker-compose.yml`: Qdrant service for local development.
- `apps/api/pyproject.toml`: API dependencies and test config.
- `apps/api/app/main.py`: FastAPI app entrypoint.
- `apps/api/app/core/config.py`: environment config.
- `apps/api/app/services/qdrant_health.py`: Qdrant health check client.
- `apps/api/tests/test_health.py`: API endpoint tests.
- `apps/worker/pyproject.toml`: worker dependencies and test config.
- `apps/worker/worker/main.py`: worker loop entrypoint.
- `apps/worker/worker/processor.py`: document polling and processing boundary.
- `apps/worker/tests/test_processor.py`: worker behavior tests.
- `packages/rag/pyproject.toml`: shared RAG package dependencies and test config.
- `packages/rag/contexta_rag/__init__.py`: shared package exports.
- `packages/rag/contexta_rag/chunking.py`: deterministic text chunking.
- `packages/rag/contexta_rag/prompts.py`: RAG prompt builder.
- `packages/rag/tests/test_chunking.py`: chunking tests.
- `packages/rag/tests/test_prompts.py`: prompt tests.
- `apps/web/package.json`: web dependencies and scripts.
- `apps/web/next.config.ts`: Next.js config.
- `apps/web/tsconfig.json`: TypeScript config.
- `apps/web/postcss.config.mjs`: PostCSS config.
- `apps/web/tailwind.config.ts`: Tailwind theme.
- `apps/web/app/globals.css`: global CSS.
- `apps/web/app/layout.tsx`: root layout.
- `apps/web/app/page.tsx`: dashboard route.
- `apps/web/app/login/page.tsx`: login route placeholder.
- `apps/web/app/register/page.tsx`: register route placeholder.
- `apps/web/app/forgot-password/page.tsx`: forgot password route placeholder.
- `apps/web/app/documents/page.tsx`: documents route placeholder.
- `apps/web/app/chat/page.tsx`: chat route placeholder.
- `apps/web/app/settings/page.tsx`: settings route placeholder.
- `apps/web/components/contexta-logo.tsx`: custom Contexta inline SVG logo.
- `apps/web/components/app-shell.tsx`: reusable shell with sidebar/header.
- `apps/web/components/ui/button.tsx`: small reusable button.
- `apps/web/components/ui/status-pill.tsx`: small reusable status pill.
- `apps/web/lib/navigation.ts`: navigation item definitions.

## Task 1: Root Project Foundation

**Files:**

- Create: `.gitignore`
- Create: `.env.example`
- Create: `README.md`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create `.gitignore`**

Create `.gitignore`:

```gitignore
.env
.env.*
!.env.example

node_modules/
.next/
out/
dist/
coverage/

__pycache__/
*.py[cod]
.pytest_cache/
.ruff_cache/
.mypy_cache/
.venv/
venv/

.qdrant/
.cache/
models/

*.log
.DS_Store
Thumbs.db
```

- [ ] **Step 2: Create `.env.example`**

Create `.env.example`:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
SUPABASE_STORAGE_BUCKET=contexta-documents

QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=contexta_chunks

DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat

EMBEDDING_MODEL_NAME=BAAI/bge-m3
EMBEDDING_DEVICE=auto
EMBEDDING_BATCH_SIZE=4

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

- [ ] **Step 3: Create `docker-compose.yml`**

Create `docker-compose.yml`:

```yaml
services:
  qdrant:
    image: qdrant/qdrant:v1.12.6
    container_name: contexta-qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - ./.qdrant/storage:/qdrant/storage
    environment:
      QDRANT__SERVICE__HTTP_PORT: 6333
      QDRANT__SERVICE__GRPC_PORT: 6334
```

- [ ] **Step 4: Create `README.md`**

Create `README.md`:

```markdown
# Contexta

Contexta is a RAG document chatbot for PDF and DOCX files.

## Apps

- `apps/web`: Next.js frontend.
- `apps/api`: FastAPI API service.
- `apps/worker`: background document processor.
- `packages/rag`: shared Python RAG utilities.

## Local Infrastructure

Start Qdrant:

```bash
docker compose up -d qdrant
```

Qdrant health:

```bash
curl http://localhost:6333/healthz
```

## Phase 1 Commands

Run shared RAG tests:

```bash
cd packages/rag
python -m pytest
```

Run API tests:

```bash
cd apps/api
python -m pytest
```

Run worker tests:

```bash
cd apps/worker
python -m pytest
```

Run web dev server:

```bash
cd apps/web
npm install
npm run dev
```
```

- [ ] **Step 5: Verify root files**

Run:

```powershell
Get-ChildItem -Force
```

Expected: output includes `.env.example`, `.gitignore`, `README.md`, `docker-compose.yml`, `apps`, `docs`, `packages` after later tasks create directories.

- [ ] **Step 6: Commit root foundation**

If the repository has been initialized with git, run:

```bash
git add .gitignore .env.example README.md docker-compose.yml
git commit -m "chore: add contexta project foundation"
```

If git has not been initialized, skip this commit step and note it in the final task report.

## Task 2: Shared RAG Package

**Files:**

- Create: `packages/rag/pyproject.toml`
- Create: `packages/rag/contexta_rag/__init__.py`
- Create: `packages/rag/contexta_rag/chunking.py`
- Create: `packages/rag/contexta_rag/prompts.py`
- Create: `packages/rag/tests/test_chunking.py`
- Create: `packages/rag/tests/test_prompts.py`

- [ ] **Step 1: Create package directories**

Create directories:

```powershell
New-Item -ItemType Directory -Force -Path packages/rag/contexta_rag, packages/rag/tests
```

- [ ] **Step 2: Create `packages/rag/pyproject.toml`**

Create `packages/rag/pyproject.toml`:

```toml
[project]
name = "contexta-rag"
version = "0.1.0"
description = "Shared RAG utilities for Contexta"
requires-python = ">=3.11"
dependencies = []

[project.optional-dependencies]
dev = [
  "pytest>=8.2.0",
]

[build-system]
requires = ["setuptools>=69.0.0"]
build-backend = "setuptools.build_meta"

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

- [ ] **Step 3: Write failing chunking tests**

Create `packages/rag/tests/test_chunking.py`:

```python
from contexta_rag.chunking import chunk_text


def test_chunk_text_returns_single_chunk_for_short_text():
    chunks = chunk_text("alpha beta gamma", max_words=10, overlap_words=2)

    assert chunks == [
        {
            "chunk_index": 0,
            "text": "alpha beta gamma",
            "start_word": 0,
            "end_word": 3,
        }
    ]


def test_chunk_text_uses_overlap_between_chunks():
    text = "one two three four five six seven eight nine ten"

    chunks = chunk_text(text, max_words=4, overlap_words=1)

    assert [chunk["text"] for chunk in chunks] == [
        "one two three four",
        "four five six seven",
        "seven eight nine ten",
    ]
    assert [chunk["chunk_index"] for chunk in chunks] == [0, 1, 2]


def test_chunk_text_rejects_invalid_overlap():
    try:
        chunk_text("alpha beta", max_words=4, overlap_words=4)
    except ValueError as exc:
        assert "overlap_words must be smaller than max_words" in str(exc)
    else:
        raise AssertionError("Expected ValueError")
```

- [ ] **Step 4: Run chunking tests and verify failure**

Run:

```powershell
cd packages/rag
python -m pytest tests/test_chunking.py -v
```

Expected: FAIL with `ModuleNotFoundError` or `ImportError` because `contexta_rag.chunking` does not exist yet.

- [ ] **Step 5: Implement chunking**

Create `packages/rag/contexta_rag/chunking.py`:

```python
from __future__ import annotations

from typing import TypedDict


class TextChunk(TypedDict):
    chunk_index: int
    text: str
    start_word: int
    end_word: int


def chunk_text(text: str, max_words: int = 800, overlap_words: int = 120) -> list[TextChunk]:
    if max_words <= 0:
        raise ValueError("max_words must be greater than 0")
    if overlap_words < 0:
        raise ValueError("overlap_words must be greater than or equal to 0")
    if overlap_words >= max_words:
        raise ValueError("overlap_words must be smaller than max_words")

    words = text.split()
    if not words:
        return []

    chunks: list[TextChunk] = []
    step = max_words - overlap_words
    start = 0

    while start < len(words):
        end = min(start + max_words, len(words))
        chunks.append(
            {
                "chunk_index": len(chunks),
                "text": " ".join(words[start:end]),
                "start_word": start,
                "end_word": end,
            }
        )
        if end == len(words):
            break
        start += step

    return chunks
```

Create `packages/rag/contexta_rag/__init__.py`:

```python
from contexta_rag.chunking import TextChunk, chunk_text
from contexta_rag.prompts import CitationContext, build_rag_prompt

__all__ = ["CitationContext", "TextChunk", "build_rag_prompt", "chunk_text"]
```

- [ ] **Step 6: Write failing prompt tests**

Create `packages/rag/tests/test_prompts.py`:

```python
from contexta_rag.prompts import build_rag_prompt


def test_build_rag_prompt_includes_question_and_sources():
    prompt = build_rag_prompt(
        question="What is the contract duration?",
        contexts=[
            {
                "document_name": "contract.pdf",
                "page_number": 4,
                "text": "The agreement runs for twelve months.",
            }
        ],
    )

    assert "What is the contract duration?" in prompt
    assert "contract.pdf" in prompt
    assert "Page 4" in prompt
    assert "The agreement runs for twelve months." in prompt
    assert "If the sources do not contain enough information" in prompt


def test_build_rag_prompt_handles_missing_page_number():
    prompt = build_rag_prompt(
        question="Summarize the document",
        contexts=[
            {
                "document_name": "memo.docx",
                "page_number": None,
                "text": "This memo describes internal policy.",
            }
        ],
    )

    assert "memo.docx" in prompt
    assert "Page unknown" in prompt
```

- [ ] **Step 7: Run prompt tests and verify failure**

Run:

```powershell
cd packages/rag
python -m pytest tests/test_prompts.py -v
```

Expected: FAIL because `contexta_rag.prompts` does not exist yet.

- [ ] **Step 8: Implement prompt builder**

Create `packages/rag/contexta_rag/prompts.py`:

```python
from __future__ import annotations

from typing import TypedDict


class CitationContext(TypedDict):
    document_name: str
    page_number: int | None
    text: str


def build_rag_prompt(question: str, contexts: list[CitationContext]) -> str:
    source_blocks: list[str] = []

    for index, context in enumerate(contexts, start=1):
        page_label = f"Page {context['page_number']}" if context["page_number"] else "Page unknown"
        source_blocks.append(
            "\n".join(
                [
                    f"[Source {index}]",
                    f"Document: {context['document_name']}",
                    page_label,
                    "Content:",
                    context["text"].strip(),
                ]
            )
        )

    sources = "\n\n".join(source_blocks) if source_blocks else "No sources were retrieved."

    return "\n".join(
        [
            "You are Contexta, a careful document analysis assistant.",
            "Answer only from the provided sources.",
            "If the sources do not contain enough information, say that the document context is insufficient.",
            "Cite the source numbers that support the answer.",
            "",
            "Sources:",
            sources,
            "",
            "Question:",
            question.strip(),
            "",
            "Answer:",
        ]
    )
```

- [ ] **Step 9: Run shared RAG tests and verify pass**

Run:

```powershell
cd packages/rag
python -m pytest -v
```

Expected: all tests PASS.

- [ ] **Step 10: Commit shared RAG package**

If git is initialized, run:

```bash
git add packages/rag
git commit -m "feat: add shared rag utilities"
```

If git has not been initialized, skip this commit step and note it in the final task report.

## Task 3: FastAPI Skeleton

**Files:**

- Create: `apps/api/pyproject.toml`
- Create: `apps/api/app/__init__.py`
- Create: `apps/api/app/main.py`
- Create: `apps/api/app/core/__init__.py`
- Create: `apps/api/app/core/config.py`
- Create: `apps/api/app/services/__init__.py`
- Create: `apps/api/app/services/qdrant_health.py`
- Create: `apps/api/tests/test_health.py`

- [ ] **Step 1: Create API directories**

Create directories:

```powershell
New-Item -ItemType Directory -Force -Path apps/api/app/core, apps/api/app/services, apps/api/tests
```

- [ ] **Step 2: Create `apps/api/pyproject.toml`**

Create `apps/api/pyproject.toml`:

```toml
[project]
name = "contexta-api"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
  "fastapi>=0.115.0",
  "httpx>=0.27.0",
  "pydantic-settings>=2.4.0",
  "uvicorn[standard]>=0.30.0",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.2.0",
  "pytest-asyncio>=0.24.0",
]

[build-system]
requires = ["setuptools>=69.0.0"]
build-backend = "setuptools.build_meta"

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
asyncio_mode = "auto"
```

- [ ] **Step 3: Write failing API health tests**

Create `apps/api/tests/test_health.py`:

```python
from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_ok():
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "contexta-api"}


def test_vector_health_handles_unavailable_qdrant():
    client = TestClient(app)

    response = client.get("/health/vector")

    assert response.status_code in {200, 503}
    assert "status" in response.json()
    assert response.json()["service"] == "qdrant"
```

- [ ] **Step 4: Run API tests and verify failure**

Run:

```powershell
cd apps/api
python -m pytest tests/test_health.py -v
```

Expected: FAIL because `app.main` does not exist yet.

- [ ] **Step 5: Implement API config and health service**

Create `apps/api/app/__init__.py`:

```python
```

Create `apps/api/app/core/__init__.py`:

```python
```

Create `apps/api/app/services/__init__.py`:

```python
```

Create `apps/api/app/core/config.py`:

```python
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    qdrant_url: str = "http://localhost:6333"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

Create `apps/api/app/services/qdrant_health.py`:

```python
from __future__ import annotations

import httpx


async def check_qdrant_health(qdrant_url: str) -> dict[str, str]:
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{qdrant_url.rstrip('/')}/healthz")
            response.raise_for_status()
    except httpx.HTTPError:
        return {"status": "unavailable", "service": "qdrant"}

    return {"status": "ok", "service": "qdrant"}
```

- [ ] **Step 6: Implement FastAPI app**

Create `apps/api/app/main.py`:

```python
from fastapi import FastAPI, Response, status

from app.core.config import get_settings
from app.services.qdrant_health import check_qdrant_health

app = FastAPI(title="Contexta API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "contexta-api"}


@app.get("/health/vector")
async def vector_health(response: Response) -> dict[str, str]:
    settings = get_settings()
    result = await check_qdrant_health(settings.qdrant_url)
    if result["status"] != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return result
```

- [ ] **Step 7: Run API tests and verify pass**

Run:

```powershell
cd apps/api
python -m pytest -v
```

Expected: all tests PASS.

- [ ] **Step 8: Manually run API**

Run:

```powershell
cd apps/api
python -m uvicorn app.main:app --reload --port 8000
```

Expected: server starts and logs `Uvicorn running on http://127.0.0.1:8000`.

- [ ] **Step 9: Commit API skeleton**

If git is initialized, run:

```bash
git add apps/api
git commit -m "feat: add fastapi health skeleton"
```

If git has not been initialized, skip this commit step and note it in the final task report.

## Task 4: Worker Skeleton

**Files:**

- Create: `apps/worker/pyproject.toml`
- Create: `apps/worker/worker/__init__.py`
- Create: `apps/worker/worker/main.py`
- Create: `apps/worker/worker/processor.py`
- Create: `apps/worker/tests/test_processor.py`

- [ ] **Step 1: Create worker directories**

Create directories:

```powershell
New-Item -ItemType Directory -Force -Path apps/worker/worker, apps/worker/tests
```

- [ ] **Step 2: Create `apps/worker/pyproject.toml`**

Create `apps/worker/pyproject.toml`:

```toml
[project]
name = "contexta-worker"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = []

[project.optional-dependencies]
dev = [
  "pytest>=8.2.0",
]

[build-system]
requires = ["setuptools>=69.0.0"]
build-backend = "setuptools.build_meta"

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

- [ ] **Step 3: Write failing worker tests**

Create `apps/worker/tests/test_processor.py`:

```python
from worker.processor import InMemoryDocumentRepository, WorkerProcessor


def test_processor_marks_processing_document_ready():
    repository = InMemoryDocumentRepository(
        [
            {
                "id": "doc_1",
                "status": "processing",
                "filename": "sample.pdf",
            }
        ]
    )
    processor = WorkerProcessor(repository=repository)

    processed = processor.process_once()

    assert processed is True
    assert repository.documents[0]["status"] == "ready"


def test_processor_returns_false_when_no_document_is_available():
    repository = InMemoryDocumentRepository([])
    processor = WorkerProcessor(repository=repository)

    processed = processor.process_once()

    assert processed is False
```

- [ ] **Step 4: Run worker tests and verify failure**

Run:

```powershell
cd apps/worker
python -m pytest tests/test_processor.py -v
```

Expected: FAIL because `worker.processor` does not exist yet.

- [ ] **Step 5: Implement worker processor**

Create `apps/worker/worker/__init__.py`:

```python
```

Create `apps/worker/worker/processor.py`:

```python
from __future__ import annotations

from typing import Protocol, TypedDict


class ProcessingDocument(TypedDict):
    id: str
    status: str
    filename: str


class DocumentRepository(Protocol):
    def claim_next_processing_document(self) -> ProcessingDocument | None:
        ...

    def mark_ready(self, document_id: str) -> None:
        ...

    def mark_failed(self, document_id: str, error_message: str) -> None:
        ...


class InMemoryDocumentRepository:
    def __init__(self, documents: list[ProcessingDocument]) -> None:
        self.documents = documents

    def claim_next_processing_document(self) -> ProcessingDocument | None:
        for document in self.documents:
            if document["status"] == "processing":
                return document
        return None

    def mark_ready(self, document_id: str) -> None:
        for document in self.documents:
            if document["id"] == document_id:
                document["status"] = "ready"
                return

    def mark_failed(self, document_id: str, error_message: str) -> None:
        for document in self.documents:
            if document["id"] == document_id:
                document["status"] = "failed"
                document["error_message"] = error_message
                return


class WorkerProcessor:
    def __init__(self, repository: DocumentRepository) -> None:
        self.repository = repository

    def process_once(self) -> bool:
        document = self.repository.claim_next_processing_document()
        if document is None:
            return False

        try:
            self._process_document(document)
        except Exception as exc:
            self.repository.mark_failed(document["id"], str(exc))
            return True

        self.repository.mark_ready(document["id"])
        return True

    def _process_document(self, document: ProcessingDocument) -> None:
        if not document["filename"].lower().endswith((".pdf", ".docx")):
            raise ValueError("Unsupported document type")
```

- [ ] **Step 6: Implement worker main loop**

Create `apps/worker/worker/main.py`:

```python
import time

from worker.processor import InMemoryDocumentRepository, WorkerProcessor


def run_worker(poll_interval_seconds: int = 5) -> None:
    repository = InMemoryDocumentRepository([])
    processor = WorkerProcessor(repository=repository)

    while True:
        processed = processor.process_once()
        if not processed:
            time.sleep(poll_interval_seconds)


if __name__ == "__main__":
    run_worker()
```

- [ ] **Step 7: Run worker tests and verify pass**

Run:

```powershell
cd apps/worker
python -m pytest -v
```

Expected: all tests PASS.

- [ ] **Step 8: Commit worker skeleton**

If git is initialized, run:

```bash
git add apps/worker
git commit -m "feat: add worker processing skeleton"
```

If git has not been initialized, skip this commit step and note it in the final task report.

## Task 5: Next.js Web Shell

**Files:**

- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/login/page.tsx`
- Create: `apps/web/app/register/page.tsx`
- Create: `apps/web/app/forgot-password/page.tsx`
- Create: `apps/web/app/documents/page.tsx`
- Create: `apps/web/app/chat/page.tsx`
- Create: `apps/web/app/settings/page.tsx`
- Create: `apps/web/components/contexta-logo.tsx`
- Create: `apps/web/components/app-shell.tsx`
- Create: `apps/web/components/ui/button.tsx`
- Create: `apps/web/components/ui/status-pill.tsx`
- Create: `apps/web/lib/navigation.ts`

- [ ] **Step 1: Create web directories**

Create directories:

```powershell
New-Item -ItemType Directory -Force -Path apps/web/app/login, apps/web/app/register, apps/web/app/forgot-password, apps/web/app/documents, apps/web/app/chat, apps/web/app/settings, apps/web/components/ui, apps/web/lib
```

- [ ] **Step 2: Create web package config**

Create `apps/web/package.json`:

```json
{
  "name": "contexta-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "next": "^15.1.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2"
  }
}
```

Create `apps/web/next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

Create `apps/web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `apps/web/postcss.config.mjs`:

```js
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
```

Create `apps/web/tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#f9f9ff",
        surface: "#ffffff",
        muted: "#f3f4f6",
        border: "#e5e7eb",
        primary: "#2563eb",
        ink: "#111827",
        subtle: "#6b7280"
      },
      fontFamily: {
        sans: ["Inter", "Arial", "sans-serif"],
        heading: ["Plus Jakarta Sans", "Inter", "Arial", "sans-serif"]
      },
      borderRadius: {
        contexta: "0.5rem"
      }
    }
  },
  plugins: []
};

export default config;
```

- [ ] **Step 3: Create global layout and CSS**

Create `apps/web/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
}

body {
  margin: 0;
  background: #f9f9ff;
  color: #111827;
}

* {
  box-sizing: border-box;
}
```

Create `apps/web/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contexta",
  description: "Chat with PDF and DOCX documents using grounded citations."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Create logo and UI primitives**

Create `apps/web/components/contexta-logo.tsx`:

```tsx
export function ContextaLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2" aria-label="Contexta">
      <svg width="32" height="32" viewBox="0 0 32 32" role="img" aria-hidden="true">
        <rect x="5" y="4" width="17" height="22" rx="3" fill="#2563eb" />
        <path d="M11 11H20M11 16H18M11 21H16" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="23.5" cy="22.5" r="4.5" fill="#111827" />
        <path d="M26.8 25.8L29 28" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
        <circle cx="23.5" cy="22.5" r="1.5" fill="white" />
      </svg>
      {!compact ? <span className="font-heading text-lg font-semibold tracking-normal">Contexta</span> : null}
    </div>
  );
}
```

Create `apps/web/components/ui/button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

const variants = {
  primary: "bg-primary text-white hover:bg-blue-700",
  secondary: "border border-border bg-white text-ink hover:bg-muted",
  ghost: "text-subtle hover:bg-muted hover:text-ink"
};

export function Button({ className = "", variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center rounded px-4 text-sm font-medium transition ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
```

Create `apps/web/components/ui/status-pill.tsx`:

```tsx
type Status = "ready" | "processing" | "failed";

const styles: Record<Status, string> = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  processing: "border-blue-200 bg-blue-50 text-blue-700",
  failed: "border-red-200 bg-red-50 text-red-700"
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}
```

- [ ] **Step 5: Create navigation and app shell**

Create `apps/web/lib/navigation.ts`:

```ts
export const navigationItems = [
  { href: "/", label: "Dashboard" },
  { href: "/documents", label: "Documents" },
  { href: "/chat", label: "Chat" },
  { href: "/settings", label: "Settings" }
];
```

Create `apps/web/components/app-shell.tsx`:

```tsx
import Link from "next/link";
import { ContextaLogo } from "@/components/contexta-logo";
import { navigationItems } from "@/lib/navigation";

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-white px-4 py-5 md:block">
        <ContextaLogo />
        <nav className="mt-8 space-y-1">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded px-3 py-2 text-sm font-medium text-subtle transition hover:bg-muted hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="md:pl-64">
        <header className="sticky top-0 z-10 border-b border-border bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="md:hidden">
              <ContextaLogo compact />
            </div>
            <h1 className="font-heading text-xl font-semibold">{title}</h1>
            <div className="h-8 w-8 rounded-full border border-border bg-muted" aria-label="User menu" />
          </div>
        </header>
        <div className="px-5 py-6">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Create app pages**

Create `apps/web/app/page.tsx`:

```tsx
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-contexta border border-border bg-white p-5">
          <p className="text-sm text-subtle">Total Documents</p>
          <p className="mt-2 text-3xl font-semibold">0</p>
        </div>
        <div className="rounded-contexta border border-border bg-white p-5">
          <p className="text-sm text-subtle">Ready</p>
          <p className="mt-2 text-3xl font-semibold">0</p>
        </div>
        <div className="rounded-contexta border border-border bg-white p-5">
          <p className="text-sm text-subtle">Recent Chats</p>
          <p className="mt-2 text-3xl font-semibold">0</p>
        </div>
      </section>
      <section className="mt-6 rounded-contexta border border-border bg-white">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="font-heading text-lg font-semibold">Document Library</h2>
            <p className="text-sm text-subtle">Upload documents to start asking grounded questions.</p>
          </div>
          <Button>Upload Document</Button>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between rounded border border-border bg-muted p-4">
            <div>
              <p className="font-medium">No documents yet</p>
              <p className="text-sm text-subtle">PDF and DOCX support will be wired in the upload phase.</p>
            </div>
            <StatusPill status="processing" />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
```

Create `apps/web/app/documents/page.tsx`:

```tsx
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export default function DocumentsPage() {
  return (
    <AppShell title="Documents">
      <section className="rounded-contexta border border-border bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold">Upload and Manage</h2>
            <p className="text-sm text-subtle">PDF and DOCX documents will appear here after upload.</p>
          </div>
          <Button>Upload</Button>
        </div>
      </section>
    </AppShell>
  );
}
```

Create `apps/web/app/chat/page.tsx`:

```tsx
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export default function ChatPage() {
  return (
    <AppShell title="Chat">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-h-[620px] rounded-contexta border border-border bg-white p-5">
          <div className="rounded-contexta border border-border bg-muted p-4 text-sm text-subtle">
            Ask a question once your documents are ready.
          </div>
          <div className="mt-4 flex gap-2">
            <input
              className="h-10 flex-1 rounded border border-border px-3 text-sm outline-none focus:border-primary"
              placeholder="Ask Contexta about your documents..."
            />
            <Button>Send</Button>
          </div>
        </section>
        <aside className="rounded-contexta border border-border bg-white p-5">
          <h2 className="font-heading text-lg font-semibold">Sources</h2>
          <p className="mt-2 text-sm text-subtle">Citations and context snippets will appear here.</p>
        </aside>
      </div>
    </AppShell>
  );
}
```

Create `apps/web/app/settings/page.tsx`:

```tsx
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <AppShell title="Settings">
      <section className="max-w-3xl rounded-contexta border border-border bg-white p-6">
        <h2 className="font-heading text-lg font-semibold">Workspace Settings</h2>
        <p className="mt-1 text-sm text-subtle">Supabase and DeepSeek settings will be connected in later phases.</p>
        <div className="mt-6">
          <Button variant="secondary">Save Changes</Button>
        </div>
      </section>
    </AppShell>
  );
}
```

- [ ] **Step 7: Create auth placeholder pages**

Create `apps/web/app/login/page.tsx`:

```tsx
import Link from "next/link";
import { ContextaLogo } from "@/components/contexta-logo";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-contexta border border-border bg-white p-8">
        <ContextaLogo />
        <h1 className="mt-8 font-heading text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-subtle">Access your private document workspace.</p>
        <div className="mt-6 space-y-3">
          <input className="h-11 w-full rounded border border-border px-3 text-sm" placeholder="Email" />
          <input className="h-11 w-full rounded border border-border px-3 text-sm" placeholder="Password" type="password" />
          <Button className="w-full">Sign in to Contexta</Button>
        </div>
        <div className="mt-5 flex justify-between text-sm">
          <Link href="/forgot-password" className="text-primary">Forgot password?</Link>
          <Link href="/register" className="text-primary">Create account</Link>
        </div>
      </section>
    </main>
  );
}
```

Create `apps/web/app/register/page.tsx`:

```tsx
import Link from "next/link";
import { ContextaLogo } from "@/components/contexta-logo";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-contexta border border-border bg-white p-8">
        <ContextaLogo />
        <h1 className="mt-8 font-heading text-2xl font-semibold">Create account</h1>
        <div className="mt-6 space-y-3">
          <input className="h-11 w-full rounded border border-border px-3 text-sm" placeholder="Full name" />
          <input className="h-11 w-full rounded border border-border px-3 text-sm" placeholder="Email" />
          <input className="h-11 w-full rounded border border-border px-3 text-sm" placeholder="Password" type="password" />
          <Button className="w-full">Create Contexta account</Button>
        </div>
        <p className="mt-5 text-sm text-subtle">
          Already have an account? <Link href="/login" className="text-primary">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
```

Create `apps/web/app/forgot-password/page.tsx`:

```tsx
import Link from "next/link";
import { ContextaLogo } from "@/components/contexta-logo";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-contexta border border-border bg-white p-8">
        <ContextaLogo />
        <h1 className="mt-8 font-heading text-2xl font-semibold">Reset password</h1>
        <p className="mt-2 text-sm text-subtle">Enter your email and Contexta will send a reset link.</p>
        <div className="mt-6 space-y-3">
          <input className="h-11 w-full rounded border border-border px-3 text-sm" placeholder="Email" />
          <Button className="w-full">Send reset link</Button>
        </div>
        <p className="mt-5 text-sm">
          <Link href="/login" className="text-primary">Back to sign in</Link>
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 8: Install and build web app**

Run:

```powershell
cd apps/web
npm install
npm run build
```

Expected: `next build` completes successfully.

- [ ] **Step 9: Commit web shell**

If git is initialized, run:

```bash
git add apps/web
git commit -m "feat: add contexta web shell"
```

If git has not been initialized, skip this commit step and note it in the final task report.

## Task 6: Local Verification

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Start Qdrant**

Run:

```powershell
docker compose up -d qdrant
```

Expected: Qdrant container starts.

- [ ] **Step 2: Verify Qdrant health**

Run:

```powershell
Invoke-RestMethod http://localhost:6333/healthz
```

Expected: response indicates Qdrant is healthy.

- [ ] **Step 3: Run shared package tests**

Run:

```powershell
cd packages/rag
python -m pytest -v
```

Expected: all tests PASS.

- [ ] **Step 4: Run API tests**

Run:

```powershell
cd apps/api
python -m pytest -v
```

Expected: all tests PASS.

- [ ] **Step 5: Run worker tests**

Run:

```powershell
cd apps/worker
python -m pytest -v
```

Expected: all tests PASS.

- [ ] **Step 6: Run web build**

Run:

```powershell
cd apps/web
npm run build
```

Expected: build completes successfully.

- [ ] **Step 7: Update README verification status**

Append this section to `README.md`:

```markdown
## Verification

Phase 1 is considered healthy when:

- Qdrant responds at `http://localhost:6333/healthz`.
- `packages/rag` tests pass.
- `apps/api` tests pass.
- `apps/worker` tests pass.
- `apps/web` builds successfully.
```

- [ ] **Step 8: Commit verification docs**

If git is initialized, run:

```bash
git add README.md
git commit -m "docs: add phase 1 verification checklist"
```

If git has not been initialized, skip this commit step and note it in the final task report.

## Self-Review Notes

Spec coverage in this Phase 1 plan:

- Monorepo structure: covered by Task 1.
- Qdrant Docker development setup: covered by Task 1 and Task 6.
- FastAPI API service boundary: covered by Task 3.
- Worker service boundary: covered by Task 4.
- Shared RAG utilities: covered by Task 2.
- Contexta branding and UI shell: covered by Task 5.
- Testing baseline: covered across Tasks 2, 3, 4, and 6.

Spec items intentionally deferred to later plans:

- Supabase Auth and database schema.
- Supabase Storage upload.
- PDF/DOCX extraction implementation.
- Local BGE-M3 embedding implementation.
- Qdrant collection creation and vector indexing.
- DeepSeek chat endpoint.
- Citation persistence and chat history.
