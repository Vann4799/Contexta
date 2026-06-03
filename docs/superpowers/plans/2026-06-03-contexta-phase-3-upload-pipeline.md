# Contexta Phase 3 Upload Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real PDF/DOCX upload from the web app through FastAPI into Supabase Storage and Supabase document metadata.

**Architecture:** The browser keeps using Supabase Auth for sessions, then sends the Supabase access token to FastAPI. FastAPI validates the token, derives a safe storage path under `<user_id>/<document_id>/<filename>`, uploads the file to Supabase Storage with the service role key, and inserts document metadata into Supabase PostgreSQL. The existing in-memory repository remains available for tests, while production routing uses a Supabase REST repository when Supabase service credentials are configured.

**Tech Stack:** FastAPI `UploadFile`, `python-multipart`, `httpx`, Supabase Storage REST API, Supabase PostgREST, Next.js client components, `@supabase/supabase-js`, TypeScript.

---

## Scope

Phase 3 includes:

- API CORS for the local Next.js frontend.
- API service clients for Supabase Storage and Supabase document metadata.
- `POST /documents/upload` multipart endpoint.
- Safe filename/path derivation and file validation.
- Frontend Documents page converted to a client workflow.
- Frontend document API helper that sends the Supabase access token.
- Upload status UI for PDF/DOCX.
- Verification for API tests, worker tests, RAG tests, web lint, and web build.

Phase 3 does not include:

- PDF/DOCX text extraction.
- BGE-M3 embeddings.
- Qdrant indexing.
- DeepSeek chat.
- Worker processing real Supabase rows.

## Planned File Structure

Create:

- `apps/api/app/documents/storage.py`: Supabase Storage upload service and in-memory fake for tests.
- `apps/web/lib/api.ts`: browser helper for authenticated Contexta API calls.
- `apps/web/components/documents/document-upload-panel.tsx`: client upload/list workflow.

Modify:

- `apps/api/pyproject.toml`: add `python-multipart>=0.0.12`.
- `apps/api/app/core/config.py`: add API CORS origin config.
- `apps/api/app/main.py`: add CORS middleware.
- `apps/api/app/documents/models.py`: add `DocumentUploadResponse` if useful.
- `apps/api/app/documents/repository.py`: add `SupabaseDocumentRepository`.
- `apps/api/app/documents/routes.py`: add `POST /documents/upload`, repository and storage dependencies.
- `apps/api/tests/test_documents.py`: add upload endpoint tests.
- `apps/web/app/documents/page.tsx`: render upload/list client component.
- `README.md`: add Phase 3 verification notes.

## Task 1: API Supabase Repository And Storage Services

**Files:**

- Modify: `apps/api/pyproject.toml`
- Modify: `apps/api/app/core/config.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/app/documents/storage.py`
- Modify: `apps/api/app/documents/repository.py`
- Modify: `apps/api/tests/test_documents.py`

- [ ] **Step 1: Add multipart dependency**

Modify `apps/api/pyproject.toml` dependencies:

```toml
"python-multipart>=0.0.12",
```

- [ ] **Step 2: Add API CORS setting**

Modify `Settings` in `apps/api/app/core/config.py`:

```python
api_cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

@property
def cors_origins(self) -> list[str]:
    return [origin.strip() for origin in self.api_cors_origins.split(",") if origin.strip()]
```

- [ ] **Step 3: Add CORS middleware**

Modify `apps/api/app/main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Keep existing health routes and document router.

- [ ] **Step 4: Write storage service**

Create `apps/api/app/documents/storage.py`:

```python
from __future__ import annotations

from typing import Protocol

import httpx


class DocumentStorage(Protocol):
    def upload_document(self, storage_path: str, content: bytes, content_type: str) -> None:
        ...


class SupabaseDocumentStorage:
    def __init__(self, supabase_url: str, service_role_key: str, bucket: str) -> None:
        self.supabase_url = supabase_url.rstrip("/")
        self.service_role_key = service_role_key
        self.bucket = bucket

    def upload_document(self, storage_path: str, content: bytes, content_type: str) -> None:
        endpoint = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{storage_path}"
        headers = {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": content_type,
            "x-upsert": "false",
        }
        response = httpx.post(endpoint, headers=headers, content=content, timeout=30.0)
        response.raise_for_status()


class InMemoryDocumentStorage:
    def __init__(self) -> None:
        self.uploads: list[tuple[str, bytes, str]] = []

    def upload_document(self, storage_path: str, content: bytes, content_type: str) -> None:
        self.uploads.append((storage_path, content, content_type))
```

- [ ] **Step 5: Add Supabase document repository**

Modify `apps/api/app/documents/repository.py` to add:

```python
import httpx


class SupabaseDocumentRepository:
    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self.supabase_url = supabase_url.rstrip("/")
        self.service_role_key = service_role_key

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
        }

    def list_documents(self, user_id: str) -> list[DocumentResponse]:
        response = httpx.get(
            f"{self.supabase_url}/rest/v1/documents",
            headers=self._headers(),
            params={
                "select": "*",
                "user_id": f"eq.{user_id}",
                "order": "created_at.desc",
            },
            timeout=15.0,
        )
        response.raise_for_status()
        return [DocumentResponse.model_validate(item) for item in response.json()]

    def create_document(self, user_id: str, document: DocumentCreate) -> DocumentResponse:
        response = httpx.post(
            f"{self.supabase_url}/rest/v1/documents",
            headers={**self._headers(), "Prefer": "return=representation"},
            json={
                "user_id": user_id,
                "filename": document.filename,
                "file_type": document.file_type,
                "file_size": document.file_size,
                "storage_path": document.storage_path,
                "status": "processing",
            },
            timeout=15.0,
        )
        response.raise_for_status()
        return DocumentResponse.model_validate(response.json()[0])
```

- [ ] **Step 6: Add service tests**

Extend `apps/api/tests/test_documents.py` with tests that use `InMemoryDocumentStorage` and fresh `InMemoryDocumentRepository` through dependency overrides. The new tests should assert:

- Uploading `policy.pdf` returns `201`.
- The created `storage_path` starts with `<user_id>/`.
- The storage fake receives the uploaded bytes.
- Uploading `.zip` returns `422`.
- Uploading an empty file returns `422`.

Run:

```powershell
Push-Location apps/api
python -m pytest tests/test_documents.py -v
Pop-Location
```

Expected before route implementation: FAIL for missing `/documents/upload`.

- [ ] **Step 7: Commit services**

After implementation in Task 2 passes tests, commit service-level work with the route work in Task 2. Do not commit a failing intermediate state.

## Task 2: API Upload Endpoint

**Files:**

- Modify: `apps/api/app/documents/routes.py`
- Modify: `apps/api/tests/test_documents.py`

- [ ] **Step 1: Add upload helpers**

In `apps/api/app/documents/routes.py`, add constants:

```python
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
ALLOWED_UPLOAD_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}
```

Add helper:

```python
def safe_filename(filename: str) -> str:
    cleaned = filename.strip().replace("\\", "/").split("/")[-1]
    if not cleaned or cleaned in {".", ".."} or ".." in cleaned.split("."):
        raise HTTPException(status_code=422, detail="Invalid filename")
    return cleaned
```

- [ ] **Step 2: Add storage dependency**

In `routes.py`, add:

```python
from app.core.config import Settings, get_settings
from app.documents.storage import DocumentStorage, SupabaseDocumentStorage

def get_document_storage(settings: Annotated[Settings, Depends(get_settings)]) -> DocumentStorage:
    return SupabaseDocumentStorage(
        settings.supabase_url,
        settings.supabase_service_role_key,
        settings.supabase_storage_bucket,
    )
```

- [ ] **Step 3: Make repository dependency use Supabase when configured**

In `routes.py`, update `get_document_repository`:

```python
from app.documents.repository import SupabaseDocumentRepository

def get_document_repository(settings: Annotated[Settings, Depends(get_settings)]) -> DocumentRepository:
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseDocumentRepository(settings.supabase_url, settings.supabase_service_role_key)
    return document_repository
```

- [ ] **Step 4: Add upload route**

Add:

```python
from uuid import uuid4
from fastapi import File, UploadFile

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
    storage: Annotated[DocumentStorage, Depends(get_document_storage)],
    file: UploadFile = File(...),
) -> DocumentResponse:
    filename = safe_filename(file.filename or "")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="File is empty")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=422, detail="File is too large")

    content_type = file.content_type or ""
    file_type = ALLOWED_UPLOAD_TYPES.get(content_type)
    if file_type is None:
        if filename.lower().endswith(".pdf"):
            file_type = "pdf"
            content_type = "application/pdf"
        elif filename.lower().endswith(".docx"):
            file_type = "docx"
            content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        else:
            raise HTTPException(status_code=422, detail="Only PDF and DOCX files are supported")

    document_id = str(uuid4())
    storage_path = f"{current_user.id}/{document_id}/{filename}"
    document = DocumentCreate(
        filename=filename,
        file_type=file_type,
        file_size=len(content),
        storage_path=storage_path,
    )
    storage.upload_document(storage_path, content, content_type)
    return repository.create_document(current_user.id, document)
```

- [ ] **Step 5: Run API tests**

Run:

```powershell
Push-Location apps/api
python -m pytest -v
Pop-Location
```

Expected: PASS.

- [ ] **Step 6: Commit API upload pipeline**

Run:

```bash
git add apps/api
git commit -m "feat: add document upload api"
```

## Task 3: Web Documents Upload UI

**Files:**

- Create: `apps/web/lib/api.ts`
- Create: `apps/web/components/documents/document-upload-panel.tsx`
- Modify: `apps/web/app/documents/page.tsx`

- [ ] **Step 1: Create API helper**

Create `apps/web/lib/api.ts`:

```ts
export type DocumentStatus = "uploaded" | "processing" | "ready" | "failed";

export type DocumentItem = {
  id: string;
  filename: string;
  file_type: "pdf" | "docx";
  file_size: number;
  status: DocumentStatus;
  error_message: string | null;
  chunk_count: number;
  created_at: string;
  updated_at: string;
};

function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

export async function listDocuments(accessToken: string): Promise<DocumentItem[]> {
  const response = await fetch(`${apiBaseUrl()}/documents`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error("Failed to load documents");
  }
  return response.json();
}

export async function uploadDocument(accessToken: string, file: File): Promise<DocumentItem> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${apiBaseUrl()}/documents/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to upload document");
  }
  return response.json();
}
```

- [ ] **Step 2: Create upload client component**

Create `apps/web/components/documents/document-upload-panel.tsx`:

```tsx
"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { DocumentItem, listDocuments, uploadDocument } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentUploadPanel() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  async function loadDocuments() {
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setDocuments([]);
        setError("Sign in to view and upload documents.");
        return;
      }
      setDocuments(await listDocuments(data.session.access_token));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, []);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setMessage(null);
    setError(null);

    const isSupported = file.name.toLowerCase().endsWith(".pdf") || file.name.toLowerCase().endsWith(".docx");
    if (!isSupported) {
      setError("Only PDF and DOCX files are supported.");
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        throw new Error("Sign in before uploading documents.");
      }
      const created = await uploadDocument(data.session.access_token, file);
      setDocuments((current) => [created, ...current]);
      setMessage(`${file.name} uploaded and queued for processing.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="rounded-contexta border border-border bg-white">
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold">Upload and Manage</h2>
          <p className="mt-1 text-sm text-subtle">Upload PDF or DOCX documents. Contexta will queue them for processing.</p>
        </div>
        <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-contexta bg-primary px-4 text-sm font-medium text-white transition hover:bg-blue-700">
          {isUploading ? "Uploading..." : "Upload"}
          <input className="sr-only" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onFileChange} disabled={isUploading} />
        </label>
      </div>
      <div className="p-5">
        {message ? <p className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}
        {isLoading ? <p className="text-sm text-subtle">Loading documents...</p> : null}
        {!isLoading && documents.length === 0 ? <p className="text-sm text-subtle">No documents uploaded yet.</p> : null}
        {documents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs font-medium uppercase text-subtle">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Size</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id} className="border-b border-border last:border-0">
                    <td className="max-w-[320px] truncate px-5 py-3 font-medium">{document.filename}</td>
                    <td className="px-5 py-3 uppercase text-subtle">{document.file_type}</td>
                    <td className="px-5 py-3 text-subtle">{formatBytes(document.file_size)}</td>
                    <td className="px-5 py-3"><StatusPill status={document.status === "uploaded" ? "processing" : document.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Replace Documents page**

Modify `apps/web/app/documents/page.tsx`:

```tsx
import { AppShell } from "@/components/app-shell";
import { DocumentUploadPanel } from "@/components/documents/document-upload-panel";

export default function DocumentsPage() {
  return (
    <AppShell title="Documents">
      <DocumentUploadPanel />
    </AppShell>
  );
}
```

- [ ] **Step 4: Run web checks**

Run:

```powershell
Push-Location apps/web
npm run lint
npm run build
Pop-Location
```

Expected: PASS.

- [ ] **Step 5: Commit web upload UI**

Run:

```bash
git add apps/web
git commit -m "feat: add document upload UI"
```

## Task 4: Phase 3 Verification

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Run API tests**

Run:

```powershell
Push-Location apps/api
python -m pytest -v
Pop-Location
```

Expected: PASS.

- [ ] **Step 2: Run worker and RAG tests**

Run:

```powershell
Push-Location apps/worker
python -m pytest -v
Pop-Location
Push-Location packages/rag
python -m pytest -v
Pop-Location
```

Expected: PASS.

- [ ] **Step 3: Run web lint/build**

Run:

```powershell
Push-Location apps/web
npm run lint
npm run build
Pop-Location
```

Expected: PASS.

- [ ] **Step 4: Manual local smoke**

With valid `.env` values:

```powershell
Push-Location apps/api
python -m uvicorn app.main:app --reload --port 8000
Pop-Location
```

In another shell:

```powershell
Push-Location apps/web
npm run dev
Pop-Location
```

Manual checks:

- Sign in.
- Open `/documents`.
- Upload a small PDF.
- Confirm the file appears in Supabase Storage under `contexta-documents/<user_id>/...`.
- Confirm a `documents` row exists with status `processing`.

- [ ] **Step 5: Update README**

Append:

```markdown
## Phase 3 Verification

Phase 3 is healthy when:

- API upload tests pass.
- Web lint and build pass.
- A signed-in user can upload a PDF or DOCX from `/documents`.
- Supabase Storage receives the file under `contexta-documents/<user_id>/...`.
- Supabase `documents` receives a metadata row with status `processing`.
```

- [ ] **Step 6: Commit verification docs**

Run:

```bash
git add README.md
git commit -m "docs: add phase 3 verification checklist"
```

## Self-Review Notes

Spec coverage in this Phase 3 plan:

- Upload PDF/DOCX: covered by API upload endpoint and web upload UI.
- Supabase Storage integration: covered by `SupabaseDocumentStorage`.
- Document metadata creation: covered by Supabase repository and upload endpoint.
- Auth ownership: upload route derives path from authenticated user id.
- Document list UI: web component fetches `/documents` with Supabase access token.

Deferred to Phase 4:

- Worker polling Supabase for real documents.
- Text extraction and chunking.
- BGE-M3 embedding.
- Qdrant indexing.
- Ready/failed processing status from actual extraction.
