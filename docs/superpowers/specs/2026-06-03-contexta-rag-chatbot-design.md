# Contexta RAG Chatbot Design

Date: 2026-06-03

## Overview

Contexta is a document chatbot web app for asking questions over uploaded PDF and DOCX files. The product uses Retrieval-Augmented Generation so answers are grounded in document chunks and include source citations.

The MVP is a single-user workspace per account. Each authenticated user can upload documents, wait for processing, chat with ready documents, view citations, and revisit chat history.

## Goals

- Support Supabase Auth from the start.
- Support PDF and DOCX uploads in the MVP.
- Process documents asynchronously so heavy extraction and embedding work does not block the API.
- Use local BGE-M3 embeddings for development on the user's RTX 3050 laptop.
- Use DeepSeek API for answer generation.
- Use Qdrant via Docker as the vector database for development.
- Use Supabase PostgreSQL for metadata and chat history.
- Use Supabase Storage for uploaded files.
- Build a clean, professional UI inspired by the provided UI/UX references without copying them directly.

## Non-Goals For MVP

- Multi-team or organization workspaces.
- Public document sharing.
- Token-by-token streaming chat responses.
- Full PDF viewer with exact text highlighting.
- Dedicated embedding microservice.
- Redis, Celery, or external queue infrastructure.

## Architecture

The project will be a monorepo:

```text
Contexta/
  apps/
    web/        Next.js frontend
    api/        FastAPI API service
    worker/     Background document processor
  packages/
    shared/     shared types/config if needed
  infra/
    qdrant/
  docs/
  docker-compose.yml
```

### Services

- `apps/web`: Next.js app for auth, dashboard, document management, chat, citations, history, and settings.
- `apps/api`: FastAPI service used by the frontend. It validates Supabase JWTs, manages document metadata, handles uploads, serves chat APIs, builds RAG prompts, calls DeepSeek, and stores chat history.
- `apps/worker`: Background processor. It polls Supabase PostgreSQL for documents with `processing` status, extracts text, chunks content, generates embeddings with local BGE-M3, indexes vectors into Qdrant, and updates document status.
- Supabase Auth: user login, registration, and session management.
- Supabase PostgreSQL: metadata, document chunks, chat sessions, and chat messages.
- Supabase Storage: uploaded PDF and DOCX files.
- Qdrant: vector database for chunk embeddings.
- DeepSeek API: answer generation from retrieved context.

The API and worker are separate processes. Embedding code starts as a shared Python module used by both API and worker. This avoids a third service in the MVP while keeping the design easy to evolve into a dedicated embedding service later.

## Upload Flow

```text
User -> Web -> API -> Supabase Storage
                 -> Supabase DB document status = processing

Worker -> Supabase DB polling
       -> Supabase Storage download
       -> Extract text
       -> Chunk text
       -> BGE-M3 embedding
       -> Qdrant upsert
       -> Supabase DB chunks + document status = ready
```

The API returns quickly after upload with the document status set to `processing`. The frontend polls or refreshes document status until it becomes `ready` or `failed`.

## Chat Flow

```text
User question
 -> API validates user and selected ready documents
 -> API embeds query using local BGE-M3 shared module
 -> API searches Qdrant with user and document filters
 -> API builds prompt with top chunks
 -> API calls DeepSeek
 -> API stores user and assistant messages
 -> API returns answer with citations
```

Default retrieval settings:

- Chunk size: about 800 tokens.
- Chunk overlap: about 120 tokens.
- Top-k retrieval: 5 chunks.
- Citations include document name, page number when available, and a source snippet.
- If retrieved context is weak or missing, the answer should say the document context is insufficient instead of inventing facts.

## Data Model

Core Supabase PostgreSQL tables:

### `profiles`

Stores user profile fields that extend Supabase Auth.

Fields:

- `id`: UUID, references Supabase auth user.
- `display_name`: text.
- `created_at`: timestamp.
- `updated_at`: timestamp.

### `documents`

Stores document metadata and processing status.

Fields:

- `id`: UUID.
- `user_id`: UUID.
- `filename`: text.
- `file_type`: `pdf` or `docx`.
- `file_size`: integer.
- `storage_path`: text.
- `status`: `uploaded`, `processing`, `ready`, or `failed`.
- `processing_started_at`: timestamp nullable.
- `error_message`: text nullable.
- `chunk_count`: integer.
- `created_at`: timestamp.
- `updated_at`: timestamp.

### `document_chunks`

Stores metadata for chunks indexed in Qdrant.

Fields:

- `id`: UUID.
- `document_id`: UUID.
- `user_id`: UUID.
- `chunk_index`: integer.
- `text`: text.
- `page_number`: integer nullable.
- `qdrant_point_id`: text.
- `created_at`: timestamp.

### `chat_sessions`

Stores a user conversation.

Fields:

- `id`: UUID.
- `user_id`: UUID.
- `title`: text.
- `created_at`: timestamp.
- `updated_at`: timestamp.

### `chat_session_documents`

Stores which ready documents are attached to a chat session.

Fields:

- `session_id`: UUID.
- `document_id`: UUID.
- `user_id`: UUID.
- `created_at`: timestamp.

### `chat_messages`

Stores user and assistant messages.

Fields:

- `id`: UUID.
- `session_id`: UUID.
- `user_id`: UUID.
- `role`: `user` or `assistant`.
- `content`: text.
- `citations`: JSONB.
- `metadata`: JSONB.
- `created_at`: timestamp.

## API Design

Supabase Auth is handled by the frontend with the Supabase SDK. Private API requests include the Supabase session token as `Authorization: Bearer <token>`. FastAPI validates the token and enforces user ownership on every private endpoint.

### Documents

- `GET /documents`: list current user's documents.
- `POST /documents/upload`: upload a PDF or DOCX and create a processing document record.
- `GET /documents/{id}`: get one document's metadata and processing status.
- `DELETE /documents/{id}`: delete document metadata, storage object, chunks, and Qdrant vectors.
- `POST /documents/{id}/retry`: retry failed document processing.

### Chat

- `GET /chat/sessions`: list chat sessions.
- `POST /chat/sessions`: create a new chat session.
- `GET /chat/sessions/{id}/messages`: list messages in a session.
- `POST /chat/sessions/{id}/messages`: send a user question and receive a complete non-streaming answer with citations.

### Health

- `GET /health`: check API availability.
- `GET /health/vector`: check Qdrant connectivity.

## Worker Design

The MVP worker uses database polling instead of Redis or Celery.

Loop:

1. Find documents with `processing` status.
2. Claim one document by setting `processing_started_at` if it is empty or stale.
3. Download the file from Supabase Storage.
4. Extract text:
   - PDF: PyMuPDF.
   - DOCX: python-docx.
5. Chunk extracted text.
6. Generate embeddings with local BGE-M3.
7. Upsert points to Qdrant with user and document metadata.
8. Insert chunk metadata into Supabase.
9. Set document status to `ready`.
10. On failure, set document status to `failed` and store a clear error message.

Embedding defaults:

- Model: `BAAI/bge-m3`.
- Dense embeddings only for MVP.
- Small batches, starting with 4 to 8 chunks on RTX 3050.
- GPU FP16 when available.
- CPU fallback if GPU execution fails.

## UI/UX Design

The provided Google Stitch UI/UX folder is a reference, not a strict implementation target. Contexta will use a cleaner, more consistent interpretation of the "Cognitive Clarity" design direction.

Visual direction:

- Professional document workspace.
- White and soft gray surfaces.
- Blue accent `#2563EB` for primary actions and active states.
- Thin borders instead of heavy shadows.
- Small radii, generally 4px to 8px.
- `Inter` for body/UI text and `Plus Jakarta Sans` for headings.
- Compact density for document tables and history lists.

Screens:

- Login.
- Register.
- Forgot Password.
- Dashboard.
- Documents.
- Chat.
- Settings.

Main flow:

```text
Login/Register
 -> Dashboard
 -> Upload Document
 -> Processing
 -> Ready
 -> Chat
 -> View citations/source snippets
 -> History saved
```

Desktop chat layout:

- Main chat area.
- Right-side source inspector for selected documents and citations.

Mobile chat layout:

- Full-screen chat.
- Sources and citations shown in a drawer or bottom sheet.

Logo:

- Product name is `Contexta`.
- MVP logo will be implemented as a lightweight custom inline SVG.
- The mark should suggest documents, context, and retrieval without looking overly robotic.

## Error Handling

Document errors:

- Reject unsupported file types.
- Show a clear failure state when storage upload fails.
- Mark documents as `failed` if extraction, embedding, or Qdrant indexing fails.
- Allow retry for failed documents.
- Keep error messages understandable for the user while logging technical detail for developers.

Chat errors:

- Do not allow chat against documents that are not `ready`.
- Return a clear message if no relevant context is found.
- Return a clear error if DeepSeek fails or the API key is invalid.
- Return `403` if a user tries to access another user's document or chat session.

## Testing Strategy

Backend unit tests:

- PDF/DOCX parser behavior.
- Chunking behavior.
- Prompt builder behavior.
- Citation formatting.

Backend integration tests:

- Document metadata creation.
- Document status transitions.
- Chat endpoint with mocked Qdrant and DeepSeek.

Frontend smoke tests:

- Auth pages render.
- Dashboard renders.
- Documents page renders.
- Chat page renders.

Manual MVP verification:

1. Register or log in with Supabase Auth.
2. Upload a PDF.
3. Upload a DOCX.
4. Confirm both documents become `ready`.
5. Ask a question against one document.
6. Ask a question across multiple documents.
7. Confirm answer citations appear.
8. Confirm chat history is saved.

## Environment Configuration

`.env.example` should include:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
SUPABASE_STORAGE_BUCKET=contexta-documents
QDRANT_URL=http://localhost:6333
DEEPSEEK_API_KEY=
EMBEDDING_MODEL_NAME=BAAI/bge-m3
```

## Deployment Direction

Development:

- Qdrant runs through Docker.
- Next.js, FastAPI API, and worker run locally.
- Supabase uses a cloud project from the start.
- BGE-M3 runs locally on the developer machine.

Future production:

- Keep Supabase for Auth, PostgreSQL, and Storage.
- Run Qdrant Cloud or self-hosted Qdrant.
- Run API and worker as separate services.
- Move BGE-M3 into a GPU server, embedding service, or external embedding API if traffic grows.

The `EmbeddingProvider` abstraction must remain in the implementation so the app can switch from local BGE-M3 to another provider later without rewriting the RAG pipeline.
