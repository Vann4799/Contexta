"use client";

import { publicApiBaseUrl } from "@/lib/api";
import { useT } from "@/lib/i18n";

const ERROR_CODES = [
  { code: "invalid_api_key", http: 401, enKey: "Missing, malformed, or unknown key" },
  { code: "api_key_revoked", http: 403, enKey: "Key was revoked" },
  { code: "api_key_expired", http: 403, enKey: "Key passed its expiry date" },
  { code: "insufficient_scope", http: 403, enKey: "Key lacks the retrieve scope" },
  { code: "quota_minute_exceeded", http: 429, enKey: "60/minute window used up" },
  { code: "quota_day_exceeded", http: 429, enKey: "Daily allowance used up" },
  { code: "too_many_failed_keys", http: 429, enKey: "Same rejected key retried too many times" },
  { code: "invalid_request", http: 422, enKey: "Body or query failed validation" },
  { code: "document_not_found", http: 404, enKey: "No such document, or key may not read it" },
  { code: "document_not_exportable", http: 409, enKey: "Indexing not finished or no chunks" },
  { code: "api_key_store_unavailable", http: 503, enKey: "Authorization storage down" },
] as const;

const MCP_TOOLS = [
  { tool: "contexta_retrieve", returns: "Top chunks for a query with document_name, page_number, section_path, and fusion score" },
  { tool: "contexta_list_documents", returns: "Every document this key can read, with chunk_count and status" },
  { tool: "contexta_export_document", returns: "One whole document as markdown or JSONL" },
] as const;

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-paper-line bg-paper-card p-6">
      <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
      {description ? (
        <p className="mt-1.5 font-secondary text-[13px] text-ink-muted">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-control border border-paper-line bg-paper p-4 font-mono text-[12.5px] leading-6 text-ink">
      {children}
    </pre>
  );
}

function EndpointRow({ method, path, label, description }: { method: string; path: string; label: string; description: string }) {
  const methodColor = method === "POST" ? "bg-accent/15 text-ink" : "bg-paper-chip text-ink-muted";
  return (
    <div className="rounded-control border border-paper-line bg-paper p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-control px-2 py-0.5 font-mono text-[11px] font-bold ${methodColor}`}>{method}</span>
        <code className="font-mono text-[13px] text-ink">{path}</code>
        <span className="text-[13px] font-semibold text-ink-muted">— {label}</span>
      </div>
      <p className="mt-1.5 font-secondary text-[12.5px] text-ink-muted">{description}</p>
    </div>
  );
}

export function ApiReference({ showHeader = true }: { showHeader?: boolean }) {
  const t = useT();
  const c = t.apiDocs;
  const base = publicApiBaseUrl();

  return (
    <div className="space-y-3">
      {showHeader ? (
        <section className="flex flex-col gap-2">
          <p className="eyebrow">{c.eyebrow}</p>
          <h2 className="text-[26px] font-semibold text-ink">{c.title}</h2>
          <p className="max-w-2xl font-secondary text-[13px] text-ink-muted">{c.description}</p>
        </section>
      ) : null}

      <SectionCard title={c.baseUrl}>
        <code className="inline-block rounded-control border border-paper-line bg-paper px-3 py-2 font-mono text-[13px] text-ink">
          {base}
        </code>
      </SectionCard>

      <SectionCard title={c.authentication}>
        <p className="font-secondary text-[13px] text-ink-muted">
          Every <code className="font-mono text-[12.5px]">/v1</code> request carries the key in the Authorization header.
          A browser login token is <strong>not</strong> accepted here.
        </p>
        <div className="mt-3">
          <CodeBlock>{`curl -X POST "${base}/v1/retrieve" \\
  -H "Authorization: Bearer ctx_live_xxxxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "refund policy", "top_k": 5}'`}</CodeBlock>
        </div>
      </SectionCard>

      <SectionCard title={c.endpoints}>
        <div className="space-y-2">
          <EndpointRow method="POST" path="/v1/retrieve" label={c.retrieve} description={c.retrieveDesc} />
          <EndpointRow method="GET" path="/v1/documents" label={c.listDocuments} description={c.listDocumentsDesc} />
          <EndpointRow method="GET" path="/v1/documents/{id}/export" label={c.exportDocument} description={c.exportDocumentDesc} />
          <EndpointRow method="GET" path="/v1/keys/me" label={c.inspectKey} description={c.inspectKeyDesc} />
        </div>
      </SectionCard>

      <SectionCard title={`POST /v1/retrieve`}>
        <p className="font-secondary text-[13px] text-ink-muted">{c.retrieveDesc}</p>
        <div className="mt-4">
          <h4 className="text-[13px] font-semibold text-ink">Request body</h4>
          <div className="mt-2 overflow-x-auto rounded-control border border-paper-line">
            <table className="w-full text-left text-[12.5px]">
              <thead className="border-b border-paper-line bg-paper-soft">
                <tr>
                  <th className="px-3 py-2 font-semibold text-ink">{c.field}</th>
                  <th className="px-3 py-2 font-semibold text-ink">{c.type}</th>
                  <th className="px-3 py-2 font-semibold text-ink">{c.default}</th>
                  <th className="px-3 py-2 font-semibold text-ink">{c.notes}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line bg-paper">
                <tr>
                  <td className="px-3 py-2 font-mono text-ink">query</td>
                  <td className="px-3 py-2 text-ink-muted">string</td>
                  <td className="px-3 py-2 text-ink-muted">{c.required}</td>
                  <td className="px-3 py-2 text-ink-muted">1–500 characters</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-ink">top_k</td>
                  <td className="px-3 py-2 text-ink-muted">int</td>
                  <td className="px-3 py-2 font-mono text-ink">5</td>
                  <td className="px-3 py-2 text-ink-muted">1–20</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-ink">document_ids</td>
                  <td className="px-3 py-2 text-ink-muted">string[]</td>
                  <td className="px-3 py-2 text-ink-muted">all</td>
                  <td className="px-3 py-2 text-ink-muted">max 50; narrowed to key scope</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-ink">doc_types</td>
                  <td className="px-3 py-2 text-ink-muted">string[]</td>
                  <td className="px-3 py-2 text-ink-muted">all</td>
                  <td className="px-3 py-2 text-ink-muted">unclassified, sop, policy, contract, report, thesis, reference, other</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-4">
          <h4 className="text-[13px] font-semibold text-ink">Response</h4>
          <div className="mt-2">
            <CodeBlock>{`{
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
}`}</CodeBlock>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={c.rateLimits}>
        <p className="font-secondary text-[13px] text-ink-muted">{c.rateLimitsDesc}</p>
        <div className="mt-3">
          <CodeBlock>{`X-RateLimit-Limit-Minute: 60
X-RateLimit-Remaining-Minute: 59
X-RateLimit-Limit-Day: 5000
X-RateLimit-Remaining-Day: 4999`}</CodeBlock>
        </div>
        <p className="mt-3 font-secondary text-[12.5px] text-ink-muted">
          Over quota returns <code className="font-mono">429</code> with a <code className="font-mono">Retry-After</code> header.
          Every request is logged for 90 days, including rejected ones.
        </p>
      </SectionCard>

      <SectionCard title={c.errors}>
        <div className="overflow-x-auto rounded-control border border-paper-line">
          <table className="w-full text-left text-[12.5px]">
            <thead className="border-b border-paper-line bg-paper-soft">
              <tr>
                <th className="px-3 py-2 font-semibold text-ink">{c.code}</th>
                <th className="px-3 py-2 font-semibold text-ink">{c.http}</th>
                <th className="px-3 py-2 font-semibold text-ink">{c.meaning}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-line bg-paper">
              {ERROR_CODES.map((e) => (
                <tr key={e.code}>
                  <td className="px-3 py-2 font-mono text-ink">{e.code}</td>
                  <td className="px-3 py-2 font-mono text-ink-muted">{e.http}</td>
                  <td className="px-3 py-2 text-ink-muted">{e.enKey}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title={c.mcp} description={c.mcpDesc}>
        <code className="inline-block rounded-control border border-paper-line bg-paper px-3 py-2 font-mono text-[13px] text-ink">
          {base}/mcp
        </code>
        <div className="mt-3">
          <CodeBlock>{`{
  "mcpServers": {
    "contexta": {
      "url": "${base}/mcp",
      "headers": { "Authorization": "Bearer ctx_live_xxxxxxxxxxxxxxxxxxxxxxxxxx" }
    }
  }
}`}</CodeBlock>
        </div>
        <div className="mt-4 overflow-x-auto rounded-control border border-paper-line">
          <table className="w-full text-left text-[12.5px]">
            <thead className="border-b border-paper-line bg-paper-soft">
              <tr>
                <th className="px-3 py-2 font-semibold text-ink">{c.tool}</th>
                <th className="px-3 py-2 font-semibold text-ink">{c.returns}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-line bg-paper">
              {MCP_TOOLS.map((m) => (
                <tr key={m.tool}>
                  <td className="px-3 py-2 font-mono text-ink">{m.tool}</td>
                  <td className="px-3 py-2 text-ink-muted">{m.returns}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title={c.keyScoping} description={c.keyScopingDesc}>
        <p className="font-secondary text-[12.5px] text-ink-muted">
          Requests that ask for a document outside the key&apos;s subset return empty results.
          Exports of out-of-scope documents answer <code className="font-mono">404</code> — the same as a non-existent document.
        </p>
      </SectionCard>
    </div>
  );
}
