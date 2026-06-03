# Contexta Phase 2 Supabase Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Supabase foundation for Contexta: database schema/RLS, API auth guard, document metadata endpoints, and real frontend auth forms.

**Architecture:** Supabase remains the source of truth for auth, PostgreSQL metadata, and future storage. The FastAPI service validates Supabase JWTs and exposes ownership-aware document metadata APIs through a repository boundary that can be tested without a live Supabase project. The Next.js app uses Supabase Auth client helpers in client components while preserving the Phase 1 app shell.

**Tech Stack:** Supabase PostgreSQL, SQL migrations, FastAPI, PyJWT, Pydantic, Pytest, Next.js App Router, TypeScript, `@supabase/supabase-js`.

---

## Scope

Phase 2 includes:

- Supabase SQL migration for core tables, indexes, triggers, and RLS policies.
- A lightweight SQL validation test to prevent accidental migration regressions.
- FastAPI config for Supabase URL, anon key, service role key, JWT secret, and storage bucket.
- FastAPI auth dependency that validates Supabase JWT bearer tokens.
- FastAPI document metadata schemas, repository protocol, in-memory repository, and document routes.
- Next.js Supabase browser client.
- Login, register, and forgot password forms wired to Supabase Auth.
- A small auth callback route and logout button.
- Documentation for applying the migration in Supabase.

Phase 2 does not include:

- Binary PDF/DOCX upload to Supabase Storage.
- Worker integration with Supabase.
- BGE-M3 embedding.
- Qdrant indexing.
- DeepSeek chat.

## Planned File Structure

Create:

- `infra/supabase/migrations/0001_initial_schema.sql`: Supabase schema, indexes, updated_at trigger, RLS policies, and storage bucket metadata.
- `infra/supabase/README.md`: how to apply the SQL migration and required bucket/env setup.
- `tests/test_supabase_migration.py`: static migration contract tests.
- `apps/api/app/auth/__init__.py`: auth package marker.
- `apps/api/app/auth/supabase_jwt.py`: JWT parsing/validation.
- `apps/api/app/auth/dependencies.py`: FastAPI current-user dependency.
- `apps/api/app/documents/__init__.py`: documents package marker.
- `apps/api/app/documents/models.py`: Pydantic request/response models.
- `apps/api/app/documents/repository.py`: repository protocol and in-memory implementation.
- `apps/api/app/documents/routes.py`: document metadata endpoints.
- `apps/api/tests/test_auth.py`: auth dependency tests.
- `apps/api/tests/test_documents.py`: document route tests.
- `apps/web/lib/supabase.ts`: browser Supabase client factory.
- `apps/web/lib/env.ts`: frontend env validation helper.
- `apps/web/components/auth/auth-form.tsx`: shared auth form client component.
- `apps/web/components/auth/logout-button.tsx`: logout client component.
- `apps/web/app/auth/callback/page.tsx`: callback/redirect screen.

Modify:

- `.env.example`: keep existing vars and document callback URL.
- `README.md`: add Phase 2 Supabase setup commands.
- `apps/api/pyproject.toml`: add `PyJWT>=2.10.0`.
- `apps/api/app/core/config.py`: add Supabase settings.
- `apps/api/app/main.py`: include document router.
- `apps/web/package.json`: add `@supabase/supabase-js`.
- `apps/web/package-lock.json`: generated dependency lock update.
- `apps/web/app/login/page.tsx`: use real login form.
- `apps/web/app/register/page.tsx`: use real register form.
- `apps/web/app/forgot-password/page.tsx`: use real password reset form.
- `apps/web/components/app-shell.tsx`: include logout button in shell.
- `apps/web/app/documents/page.tsx`: fetch document metadata from API client placeholder when token exists, with static fallback.

## Task 1: Supabase Schema And RLS

**Files:**

- Create: `infra/supabase/migrations/0001_initial_schema.sql`
- Create: `infra/supabase/README.md`
- Create: `tests/test_supabase_migration.py`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Create migration directories**

Run:

```powershell
New-Item -ItemType Directory -Force -Path infra/supabase/migrations, tests
```

- [ ] **Step 2: Write failing migration contract tests**

Create `tests/test_supabase_migration.py`:

```python
from pathlib import Path


MIGRATION = Path("infra/supabase/migrations/0001_initial_schema.sql")


def test_initial_migration_defines_core_tables():
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    for table in [
        "public.profiles",
        "public.documents",
        "public.document_chunks",
        "public.chat_sessions",
        "public.chat_session_documents",
        "public.chat_messages",
    ]:
        assert f"create table if not exists {table}" in sql


def test_initial_migration_enables_rls_and_owner_policies():
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    for table in [
        "profiles",
        "documents",
        "document_chunks",
        "chat_sessions",
        "chat_session_documents",
        "chat_messages",
    ]:
        assert f"alter table public.{table} enable row level security" in sql

    assert "auth.uid() = user_id" in sql
    assert "auth.uid() = id" in sql


def test_initial_migration_adds_document_indexes_and_bucket():
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "idx_documents_user_status" in sql
    assert "idx_document_chunks_document_id" in sql
    assert "idx_chat_messages_session_id" in sql
    assert "contexta-documents" in sql
```

- [ ] **Step 3: Run migration tests and verify failure**

Run:

```powershell
python -m pytest tests/test_supabase_migration.py -v
```

Expected: FAIL because the migration file does not exist.

- [ ] **Step 4: Create initial Supabase migration**

Create `infra/supabase/migrations/0001_initial_schema.sql`:

```sql
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  file_type text not null check (file_type in ('pdf', 'docx')),
  file_size bigint not null check (file_size >= 0),
  storage_path text not null,
  status text not null default 'processing' check (status in ('uploaded', 'processing', 'ready', 'failed')),
  processing_started_at timestamptz,
  error_message text,
  chunk_count integer not null default 0 check (chunk_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  text text not null,
  page_number integer check (page_number is null or page_number > 0),
  qdrant_point_id text not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index),
  unique (qdrant_point_id)
);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_session_documents (
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, document_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_documents_user_status on public.documents (user_id, status, created_at desc);
create index if not exists idx_document_chunks_document_id on public.document_chunks (document_id, chunk_index);
create index if not exists idx_document_chunks_user_id on public.document_chunks (user_id);
create index if not exists idx_chat_sessions_user_updated on public.chat_sessions (user_id, updated_at desc);
create index if not exists idx_chat_messages_session_id on public.chat_messages (session_id, created_at);
create index if not exists idx_chat_session_documents_user_id on public.chat_session_documents (user_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists set_chat_sessions_updated_at on public.chat_sessions;
create trigger set_chat_sessions_updated_at
before update on public.chat_sessions
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_session_documents enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own" on public.documents for select using (auth.uid() = user_id);
drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own" on public.documents for insert with check (auth.uid() = user_id);
drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own" on public.documents for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own" on public.documents for delete using (auth.uid() = user_id);

drop policy if exists "document_chunks_select_own" on public.document_chunks;
create policy "document_chunks_select_own" on public.document_chunks for select using (auth.uid() = user_id);
drop policy if exists "document_chunks_insert_own" on public.document_chunks;
create policy "document_chunks_insert_own" on public.document_chunks for insert with check (auth.uid() = user_id);
drop policy if exists "document_chunks_delete_own" on public.document_chunks;
create policy "document_chunks_delete_own" on public.document_chunks for delete using (auth.uid() = user_id);

drop policy if exists "chat_sessions_select_own" on public.chat_sessions;
create policy "chat_sessions_select_own" on public.chat_sessions for select using (auth.uid() = user_id);
drop policy if exists "chat_sessions_insert_own" on public.chat_sessions;
create policy "chat_sessions_insert_own" on public.chat_sessions for insert with check (auth.uid() = user_id);
drop policy if exists "chat_sessions_update_own" on public.chat_sessions;
create policy "chat_sessions_update_own" on public.chat_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "chat_sessions_delete_own" on public.chat_sessions;
create policy "chat_sessions_delete_own" on public.chat_sessions for delete using (auth.uid() = user_id);

drop policy if exists "chat_session_documents_select_own" on public.chat_session_documents;
create policy "chat_session_documents_select_own" on public.chat_session_documents for select using (auth.uid() = user_id);
drop policy if exists "chat_session_documents_insert_own" on public.chat_session_documents;
create policy "chat_session_documents_insert_own" on public.chat_session_documents for insert with check (auth.uid() = user_id);
drop policy if exists "chat_session_documents_delete_own" on public.chat_session_documents;
create policy "chat_session_documents_delete_own" on public.chat_session_documents for delete using (auth.uid() = user_id);

drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own" on public.chat_messages for select using (auth.uid() = user_id);
drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own" on public.chat_messages for insert with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('contexta-documents', 'contexta-documents', false)
on conflict (id) do nothing;

drop policy if exists "storage_contexta_documents_select_own" on storage.objects;
create policy "storage_contexta_documents_select_own" on storage.objects
for select using (
  bucket_id = 'contexta-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "storage_contexta_documents_insert_own" on storage.objects;
create policy "storage_contexta_documents_insert_own" on storage.objects
for insert with check (
  bucket_id = 'contexta-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "storage_contexta_documents_delete_own" on storage.objects;
create policy "storage_contexta_documents_delete_own" on storage.objects
for delete using (
  bucket_id = 'contexta-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);
```

- [ ] **Step 5: Create Supabase README**

Create `infra/supabase/README.md`:

```markdown
# Supabase Setup

Contexta uses Supabase for Auth, PostgreSQL metadata, and Storage.

## Apply Migration

Open the Supabase SQL editor for the project and run:

```sql
-- contents of infra/supabase/migrations/0001_initial_schema.sql
```

The migration creates:

- User-owned metadata tables.
- Row-level security policies.
- The private `contexta-documents` storage bucket.
- Storage object policies scoped by the first folder segment, which must be the authenticated user id.

## Required Environment

Set these values in local `.env` files:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
SUPABASE_STORAGE_BUCKET=contexta-documents
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
```

- [ ] **Step 6: Update env and root README**

Append to `.env.example`:

```text
NEXT_PUBLIC_AUTH_CALLBACK_URL=http://localhost:3000/auth/callback
```

Append to `README.md`:

```markdown
## Supabase Setup

Phase 2 adds Supabase Auth and metadata schema. Apply the SQL in:

```text
infra/supabase/migrations/0001_initial_schema.sql
```

The frontend expects:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_AUTH_CALLBACK_URL
```

The API expects:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET
SUPABASE_STORAGE_BUCKET
```
```

- [ ] **Step 7: Run migration tests**

Run:

```powershell
python -m pytest tests/test_supabase_migration.py -v
```

Expected: PASS.

- [ ] **Step 8: Commit schema foundation**

Run:

```bash
git add .env.example README.md infra/supabase tests/test_supabase_migration.py
git commit -m "feat: add supabase schema foundation"
```

## Task 2: API Supabase Auth Guard

**Files:**

- Modify: `apps/api/pyproject.toml`
- Modify: `apps/api/app/core/config.py`
- Create: `apps/api/app/auth/__init__.py`
- Create: `apps/api/app/auth/supabase_jwt.py`
- Create: `apps/api/app/auth/dependencies.py`
- Create: `apps/api/tests/test_auth.py`

- [ ] **Step 1: Add API dependency**

Modify `apps/api/pyproject.toml` dependencies to include:

```toml
"PyJWT>=2.10.0",
```

- [ ] **Step 2: Extend API settings**

Modify `apps/api/app/core/config.py` so `Settings` includes:

```python
supabase_url: str = ""
supabase_anon_key: str = ""
supabase_service_role_key: str = ""
supabase_jwt_secret: str = "test-secret"
supabase_storage_bucket: str = "contexta-documents"
```

- [ ] **Step 3: Write auth tests**

Create `apps/api/tests/test_auth.py`:

```python
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi import HTTPException

from app.auth.supabase_jwt import CurrentUser, decode_supabase_jwt


def _token(secret: str, **claims: object) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": "11111111-1111-4111-8111-111111111111",
        "email": "ada@example.com",
        "aud": "authenticated",
        "role": "authenticated",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=10)).timestamp()),
    }
    payload.update(claims)
    return jwt.encode(payload, secret, algorithm="HS256")


def test_decode_supabase_jwt_returns_current_user():
    token = _token("secret")

    user = decode_supabase_jwt(token, "secret")

    assert user == CurrentUser(
        id="11111111-1111-4111-8111-111111111111",
        email="ada@example.com",
        role="authenticated",
    )


def test_decode_supabase_jwt_rejects_wrong_secret():
    token = _token("secret")

    with pytest.raises(HTTPException) as exc:
        decode_supabase_jwt(token, "other-secret")

    assert exc.value.status_code == 401


def test_decode_supabase_jwt_requires_subject():
    token = _token("secret", sub="")

    with pytest.raises(HTTPException) as exc:
        decode_supabase_jwt(token, "secret")

    assert exc.value.status_code == 401
```

- [ ] **Step 4: Run auth tests and verify failure**

Run:

```powershell
Push-Location apps/api
python -m pytest tests/test_auth.py -v
Pop-Location
```

Expected: FAIL because auth module does not exist yet.

- [ ] **Step 5: Implement JWT auth module**

Create `apps/api/app/auth/__init__.py`:

```python
```

Create `apps/api/app/auth/supabase_jwt.py`:

```python
from __future__ import annotations

from dataclasses import dataclass

import jwt
from fastapi import HTTPException, status


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None
    role: str


def decode_supabase_jwt(token: str, jwt_secret: str) -> CurrentUser:
    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from exc

    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    role = payload.get("role")
    return CurrentUser(
        id=subject,
        email=payload.get("email") if isinstance(payload.get("email"), str) else None,
        role=role if isinstance(role, str) else "authenticated",
    )
```

Create `apps/api/app/auth/dependencies.py`:

```python
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.supabase_jwt import CurrentUser, decode_supabase_jwt
from app.core.config import get_settings

bearer_scheme = HTTPBearer(auto_error=True)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> CurrentUser:
    settings = get_settings()
    return decode_supabase_jwt(credentials.credentials, settings.supabase_jwt_secret)
```

- [ ] **Step 6: Run API tests**

Run:

```powershell
Push-Location apps/api
python -m pytest -v
Pop-Location
```

Expected: PASS.

- [ ] **Step 7: Commit API auth guard**

Run:

```bash
git add apps/api
git commit -m "feat: add supabase jwt auth guard"
```

## Task 3: API Document Metadata Routes

**Files:**

- Create: `apps/api/app/documents/__init__.py`
- Create: `apps/api/app/documents/models.py`
- Create: `apps/api/app/documents/repository.py`
- Create: `apps/api/app/documents/routes.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/tests/test_documents.py`

- [ ] **Step 1: Write document route tests**

Create `apps/api/tests/test_documents.py`:

```python
from datetime import UTC, datetime, timedelta

import jwt
from fastapi.testclient import TestClient

from app.main import app


SECRET = "test-secret"
USER_ID = "22222222-2222-4222-8222-222222222222"


def _headers() -> dict[str, str]:
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": USER_ID,
            "email": "grace@example.com",
            "aud": "authenticated",
            "role": "authenticated",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=10)).timestamp()),
        },
        SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def test_documents_require_authentication():
    client = TestClient(app)

    response = client.get("/documents")

    assert response.status_code == 403


def test_create_and_list_document_metadata():
    client = TestClient(app)

    create_response = client.post(
        "/documents",
        headers=_headers(),
        json={
            "filename": "policy.pdf",
            "file_type": "pdf",
            "file_size": 1200,
            "storage_path": f"{USER_ID}/policy.pdf",
        },
    )

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["filename"] == "policy.pdf"
    assert created["status"] == "processing"

    list_response = client.get("/documents", headers=_headers())

    assert list_response.status_code == 200
    assert any(document["id"] == created["id"] for document in list_response.json())


def test_create_document_rejects_unsupported_type():
    client = TestClient(app)

    response = client.post(
        "/documents",
        headers=_headers(),
        json={
            "filename": "archive.zip",
            "file_type": "zip",
            "file_size": 1200,
            "storage_path": f"{USER_ID}/archive.zip",
        },
    )

    assert response.status_code == 422
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
Push-Location apps/api
python -m pytest tests/test_documents.py -v
Pop-Location
```

Expected: FAIL because document routes do not exist yet.

- [ ] **Step 3: Implement document models**

Create `apps/api/app/documents/__init__.py`:

```python
```

Create `apps/api/app/documents/models.py`:

```python
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

DocumentFileType = Literal["pdf", "docx"]
DocumentStatus = Literal["uploaded", "processing", "ready", "failed"]


class DocumentCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    file_type: DocumentFileType
    file_size: int = Field(ge=0)
    storage_path: str = Field(min_length=1, max_length=1024)


class DocumentResponse(BaseModel):
    id: str
    user_id: str
    filename: str
    file_type: DocumentFileType
    file_size: int
    storage_path: str
    status: DocumentStatus
    error_message: str | None
    chunk_count: int
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 4: Implement in-memory repository**

Create `apps/api/app/documents/repository.py`:

```python
from __future__ import annotations

from datetime import UTC, datetime
from typing import Protocol
from uuid import uuid4

from app.documents.models import DocumentCreate, DocumentResponse


class DocumentRepository(Protocol):
    def list_documents(self, user_id: str) -> list[DocumentResponse]:
        ...

    def create_document(self, user_id: str, payload: DocumentCreate) -> DocumentResponse:
        ...


class InMemoryDocumentRepository:
    def __init__(self) -> None:
        self._documents: list[DocumentResponse] = []

    def list_documents(self, user_id: str) -> list[DocumentResponse]:
        return [document for document in self._documents if document.user_id == user_id]

    def create_document(self, user_id: str, payload: DocumentCreate) -> DocumentResponse:
        now = datetime.now(UTC)
        document = DocumentResponse(
            id=str(uuid4()),
            user_id=user_id,
            filename=payload.filename,
            file_type=payload.file_type,
            file_size=payload.file_size,
            storage_path=payload.storage_path,
            status="processing",
            error_message=None,
            chunk_count=0,
            created_at=now,
            updated_at=now,
        )
        self._documents.append(document)
        return document


document_repository = InMemoryDocumentRepository()
```

- [ ] **Step 5: Implement document routes**

Create `apps/api/app/documents/routes.py`:

```python
from fastapi import APIRouter, Depends, status

from app.auth.dependencies import get_current_user
from app.auth.supabase_jwt import CurrentUser
from app.documents.models import DocumentCreate, DocumentResponse
from app.documents.repository import DocumentRepository, document_repository

router = APIRouter(prefix="/documents", tags=["documents"])


def get_document_repository() -> DocumentRepository:
    return document_repository


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    current_user: CurrentUser = Depends(get_current_user),
    repository: DocumentRepository = Depends(get_document_repository),
) -> list[DocumentResponse]:
    return repository.list_documents(current_user.id)


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    payload: DocumentCreate,
    current_user: CurrentUser = Depends(get_current_user),
    repository: DocumentRepository = Depends(get_document_repository),
) -> DocumentResponse:
    return repository.create_document(current_user.id, payload)
```

Modify `apps/api/app/main.py`:

```python
from app.documents.routes import router as documents_router

app.include_router(documents_router)
```

- [ ] **Step 6: Run API tests**

Run:

```powershell
Push-Location apps/api
python -m pytest -v
Pop-Location
```

Expected: PASS.

- [ ] **Step 7: Commit document routes**

Run:

```bash
git add apps/api
git commit -m "feat: add document metadata api"
```

## Task 4: Frontend Supabase Auth

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/web/package-lock.json`
- Create: `apps/web/lib/env.ts`
- Create: `apps/web/lib/supabase.ts`
- Create: `apps/web/components/auth/auth-form.tsx`
- Create: `apps/web/components/auth/logout-button.tsx`
- Create: `apps/web/app/auth/callback/page.tsx`
- Modify: `apps/web/app/login/page.tsx`
- Modify: `apps/web/app/register/page.tsx`
- Modify: `apps/web/app/forgot-password/page.tsx`
- Modify: `apps/web/components/app-shell.tsx`

- [ ] **Step 1: Install Supabase JS**

Run:

```powershell
Push-Location apps/web
npm install @supabase/supabase-js
Pop-Location
```

- [ ] **Step 2: Create frontend env helper**

Create `apps/web/lib/env.ts`:

```ts
export function getRequiredPublicEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "NEXT_PUBLIC_AUTH_CALLBACK_URL") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}
```

- [ ] **Step 3: Create Supabase browser client**

Create `apps/web/lib/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { getRequiredPublicEnv } from "@/lib/env";

export function createBrowserSupabaseClient() {
  return createClient(
    getRequiredPublicEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}
```

- [ ] **Step 4: Create shared auth form**

Create `apps/web/components/auth/auth-form.tsx`:

```tsx
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { getRequiredPublicEnv } from "@/lib/env";
import { Button } from "@/components/ui/button";

type Mode = "login" | "register" | "reset";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    const supabase = createBrowserSupabaseClient();

    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.push("/");
        router.refresh();
      }

      if (mode === "register") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: getRequiredPublicEnv("NEXT_PUBLIC_AUTH_CALLBACK_URL")
          }
        });
        if (signUpError) throw signUpError;
        setMessage("Check your email to confirm your Contexta account.");
      }

      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getRequiredPublicEnv("NEXT_PUBLIC_AUTH_CALLBACK_URL")
        });
        if (resetError) throw resetError;
        setMessage("Password reset link sent. Check your email.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-6 space-y-3" onSubmit={onSubmit}>
      {mode === "register" ? (
        <input className="h-11 w-full rounded border border-border px-3 text-sm outline-none focus:border-primary" placeholder="Full name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      ) : null}
      <input className="h-11 w-full rounded border border-border px-3 text-sm outline-none focus:border-primary" placeholder="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      {mode !== "reset" ? (
        <input className="h-11 w-full rounded border border-border px-3 text-sm outline-none focus:border-primary" placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
      ) : null}
      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Please wait..." : mode === "login" ? "Sign in to Contexta" : mode === "register" ? "Create Contexta account" : "Send reset link"}
      </Button>
      {message ? <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
```

- [ ] **Step 5: Add logout button**

Create `apps/web/components/auth/logout-button.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" onClick={logout}>
      Log out
    </Button>
  );
}
```

- [ ] **Step 6: Wire auth pages and callback**

Modify login/register/forgot password pages to replace static inputs with:

```tsx
<AuthForm mode="login" />
<AuthForm mode="register" />
<AuthForm mode="reset" />
```

Create `apps/web/app/auth/callback/page.tsx`:

```tsx
import Link from "next/link";
import { ContextaLogo } from "@/components/contexta-logo";

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-md rounded-contexta border border-border bg-white p-6 shadow-soft sm:p-8">
        <ContextaLogo />
        <h1 className="mt-8 font-heading text-2xl font-semibold">Authentication complete</h1>
        <p className="mt-2 text-sm text-subtle">You can now return to your Contexta workspace.</p>
        <Link className="mt-6 inline-flex h-10 items-center rounded bg-primary px-4 text-sm font-medium text-white" href="/">
          Open dashboard
        </Link>
      </section>
    </main>
  );
}
```

Modify `apps/web/components/app-shell.tsx` to import and render:

```tsx
import { LogoutButton } from "@/components/auth/logout-button";
```

and place `<LogoutButton />` in the header actions area.

- [ ] **Step 7: Run web checks**

Run:

```powershell
Push-Location apps/web
npm run lint
npm run build
Pop-Location
```

Expected: PASS.

- [ ] **Step 8: Commit frontend auth**

Run:

```bash
git add apps/web
git commit -m "feat: wire supabase auth forms"
```

## Task 5: Phase 2 Verification

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Run migration test**

Run:

```powershell
python -m pytest tests/test_supabase_migration.py -v
```

Expected: PASS.

- [ ] **Step 2: Run API tests**

Run:

```powershell
Push-Location apps/api
python -m pytest -v
Pop-Location
```

Expected: PASS.

- [ ] **Step 3: Run worker tests**

Run:

```powershell
Push-Location apps/worker
python -m pytest -v
Pop-Location
```

Expected: PASS.

- [ ] **Step 4: Run shared RAG tests**

Run:

```powershell
Push-Location packages/rag
python -m pytest -v
Pop-Location
```

Expected: PASS.

- [ ] **Step 5: Run web lint and build**

Run:

```powershell
Push-Location apps/web
npm run lint
npm run build
Pop-Location
```

Expected: PASS.

- [ ] **Step 6: Update README verification**

Append this section to `README.md`:

```markdown
## Phase 2 Verification

Phase 2 is healthy when:

- Supabase migration contract tests pass.
- API auth and document metadata tests pass.
- Existing worker and RAG tests still pass.
- Web lint and build pass.

Manual Supabase verification requires real project credentials in `.env` files and applying `infra/supabase/migrations/0001_initial_schema.sql` in the Supabase SQL editor.
```

- [ ] **Step 7: Commit verification docs**

Run:

```bash
git add README.md
git commit -m "docs: add phase 2 verification checklist"
```

## Self-Review Notes

Spec coverage in this Phase 2 plan:

- Supabase Auth from the start: covered by Tasks 2 and 4.
- Single-user workspace ownership: covered by RLS policies and JWT user dependency.
- Document metadata model: covered by Tasks 1 and 3.
- Supabase PostgreSQL schema: covered by Task 1.
- Storage bucket foundation: covered by Task 1.
- UI auth flow: covered by Task 4.
- Testing baseline: covered by Tasks 1, 2, 3, and 5.

Deferred to later phases:

- Real Supabase database repository in API.
- Real PDF/DOCX binary upload.
- Worker polling Supabase.
- Text extraction, chunk insertion, embedding, and Qdrant indexing.
- DeepSeek chat and citations.
