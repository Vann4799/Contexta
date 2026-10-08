# Contexta public API — `/v1`

Read-only access to your indexed documents, authenticated with an API key instead of a
user login. Create and manage keys at **Settings → Developer** in the web app.

Base URL: `https://api.3.27.119.26.sslip.io`

## Authentication

Every `/v1` request carries the key in the Authorization header:

```bash
curl -X POST "$BASE/v1/retrieve" \
  -H "Authorization: Bearer ctx_live_xxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"query": "refund policy", "top_k": 5}'
```

The key is shown **once** when it is created and cannot be recovered afterwards — only its
SHA-256 digest is stored. Losing it means revoking the key and making a new one.

A browser login token (`supabase` JWT) is **not** an API key and is not accepted here.

### Quota

Each key is limited to **60 requests/minute** and **5.000 requests/day**. Remaining quota is
on every successful response:

```
X-RateLimit-Limit-Minute: 60
X-RateLimit-Remaining-Minute: 59
X-RateLimit-Limit-Day: 5000
X-RateLimit-Remaining-Day: 4999
```

Over quota returns `429` with a `Retry-After` in seconds until the minute window resets.
These header names are CORS-exposed, so a browser-side integrator can read them too.
Every request — including rejected ones — is written to your audit log with the status it
actually received, and appears on the Developer page. Logs are kept for 90 days.

## `POST /v1/retrieve`

Returns the document chunks closest to a question. It does **not** call an LLM and produces
no answer text — the retrieval is the product here, so you pay no model tokens per call.

Request:

| Field | Type | Default | Notes |
|---|---|---|---|
| `query` | string | required | 1–500 characters |
| `top_k` | int | `5` | 1–20 |
| `document_ids` | string[] | all | max 50; narrowed to the key's own subset, never widened |
| `doc_types` | string[] | all | one of `unclassified, sop, policy, contract, report, thesis, reference, other` |

Unknown fields are rejected with `422` rather than ignored, so a typo'd `document_id`
cannot silently drop your filter and return the whole workspace.

Response:

```json
{
  "data": [
    {
      "document_id": "0f0d…",
      "document_name": "policy-2026.pdf",
      "doc_type": "policy",
      "chunk_index": 3,
      "page_number": 7,
      "section_path": "3. Refunds",
      "text": "…",
      "score": 0.68
    }
  ],
  "meta": {
    "query": "refund policy",
    "top_k": 5,
    "retrieved": 5,
    "document_scope": "all"
  }
}
```

`score` is the best cosine similarity across the two embedding models Contexta searches; the
result order is a rank fusion of both, so treat `score` as display-only and the array order
as the ranking.

## `GET /v1/documents`

Lists the documents this key may read:

```json
{ "data": [ { "id": "0f0d…", "filename": "policy-2026.pdf", "file_type": "pdf",
              "status": "ready", "doc_type": "policy", "chunk_count": 24,
              "indexed_at": "2026-10-07T04:30:00+00:00" } ],
  "meta": { "total": 1 } }
```

Storage paths and user ids are never included.

## `GET /v1/documents/{id}/export?format=md|jsonl`

The full indexed text of one document, as Markdown or JSONL. Not JSON, so there is no
`data`/`meta` envelope; the filename comes from `Content-Disposition`.

Only documents with completed indexing respond. A `processing` or `failed` document returns
`409`, even when it still carries chunk rows from an earlier attempt — those are the text of
a document that is half-rebuilt, not the one you asked for.

## `GET /v1/keys/me`

What the calling key is: name, scopes, whether it is limited to a document subset, its
configured limits, and what is left of today's quota. Useful for a client that wants to
back off before it hits `429`.

## Key scoping

A key can be created against a subset of documents. Requests that ask for a document
outside that subset simply return nothing, and exports of those documents answer `404` — the
same response as for a document that does not exist, so a scoped key cannot probe the rest
of the workspace.

## MCP (Claude Desktop, Cursor, any MCP client)

The same key works as an MCP server, so an agent can search your documents without you
writing any HTTP glue:

```
https://api.3.27.119.26.sslip.io/mcp
```

```json
{
  "mcpServers": {
    "contexta": {
      "url": "https://api.3.27.119.26.sslip.io/mcp",
      "headers": { "Authorization": "Bearer ctx_live_xxxxxxxxxxxxxxxxxxxxxxxxxx" }
    }
  }
}
```

Three tools are exposed, one per endpoint above:

| Tool | Returns |
|---|---|
| `contexta_retrieve` | the top chunks for a query, with `document_name`, `page_number`, `section_path` and a fusion score |
| `contexta_list_documents` | every document this key can read, with `chunk_count` and `status` |
| `contexta_export_document` | one whole document as markdown or JSONL |

Nothing about MCP is privileged or separate: the tool call carries your key to the same
`/v1` endpoint, so it consumes the same quota and appears in the same usage panel. A
request whose arguments fail the tool schema (a missing `query`, `top_k` above 20) is
rejected before it reaches the API and costs nothing. A call without any `Authorization`
header is refused at the MCP layer with `401 missing_api_key`.

There are no MCP *resources* or *prompts* — Contexta hands back retrieved text and leaves
the answering to whatever is on the other end.

## Errors

```json
{ "detail": { "code": "quota_day_exceeded", "message": "Daily request limit reached for this API key." } }
```

| `code` | HTTP | Meaning |
|---|---|---|
| `invalid_api_key` | 401 | Missing, malformed, or unknown key |
| `api_key_revoked` | 403 | Key was revoked |
| `api_key_expired` | 403 | Key passed its expiry date |
| `insufficient_scope` | 403 | Key lacks the `retrieve` scope |
| `quota_minute_exceeded` | 429 | 60/minute window used up, see `Retry-After` |
| `quota_day_exceeded` | 429 | Daily allowance used up |
| `too_many_failed_keys` | 429 | Too many unknown keys from one address |
| `invalid_request` | 422 | Body or query failed validation |
| `document_not_found` | 404 | No such document, or this key may not read it |
| `document_not_exportable` | 409 | Indexing has not finished, or the document has no indexed chunks |
| `api_key_store_unavailable` | 503 | Authorization storage is down; retry |

## Limits of this surface

- Retrieval only. No answer generation, no uploads, no chat sessions.
- No key rotation: revoke and create a replacement.
- `text` is the real document text. A key can slowly export your whole corpus — that is what
  it is for. Revoke at any time, and prefer a document subset for keys you embed in tools.
