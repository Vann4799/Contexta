"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Files, HardDrive, Layers, RefreshCw, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getIndexingHealth, listDocuments, type DocumentItem, type DocumentStatus, type IndexingHealth } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { StatusPill } from "@/components/ui/status-pill";

function statusForPill(status: DocumentStatus) {
  return status === "uploaded" ? "processing" : status;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function dashboardErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load dashboard insights.";
}

function indexingHealthLabel(health: IndexingHealth | null) {
  if (!health) {
    return "Unknown";
  }

  return health.status === "attention" ? "Needs attention" : "Active";
}

function indexingHealthDetail(health: IndexingHealth | null) {
  if (!health) {
    return "Indexing health could not be inferred.";
  }

  if (health.status === "attention") {
    return `${health.stale_processing_documents} stale for ${health.stale_after_minutes}+ min`;
  }

  if (health.queued_documents > 0) {
    return `${health.queued_documents} queued`;
  }

  return "No stale jobs";
}

export function DashboardInsights() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [indexingHealth, setIndexingHealth] = useState<IndexingHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [libraryFilter, setLibraryFilter] = useState("");

  const getAccessToken = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      try {
        setIndexingHealth(await getIndexingHealth());
      } catch {
        setIndexingHealth(null);
      }

      const accessToken = await getAccessToken();
      if (!accessToken) {
        setDocuments([]);
        setError("Sign in to view dashboard insights.");
        return;
      }

      setDocuments(await listDocuments(accessToken));
    } catch (loadError) {
      setError(dashboardErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const stats = useMemo(() => {
    const readyDocuments = documents.filter((document) => document.status === "ready").length;
    const processingDocuments = documents.filter((document) => document.status === "processing" || document.status === "uploaded").length;
    const totalChunks = documents.reduce((sum, document) => sum + document.chunk_count, 0);
    const totalStorage = documents.reduce((sum, document) => sum + document.file_size, 0);

    return [
      { label: "Total Documents", value: documents.length.toString(), helper: `${readyDocuments} ready`, icon: Files },
      { label: "Processing", value: processingDocuments.toString(), helper: "Uploads being indexed", icon: RefreshCw },
      { label: "Storage Used", value: formatBytes(totalStorage), helper: "Document file size", icon: HardDrive },
      { label: "Indexed Chunks", value: totalChunks.toString(), helper: "Searchable text blocks", icon: Layers }
    ];
  }, [documents]) satisfies Array<{ label: string; value: string; helper: string; icon: LucideIcon }>;

  const recentDocuments = documents.slice(0, 3);
  const normalizedLibraryFilter = libraryFilter.trim().toLowerCase();
  const filteredDocuments = normalizedLibraryFilter
    ? documents.filter((document) =>
        [
          document.filename,
          document.file_type,
          document.status
        ].some((value) => value.toLowerCase().includes(normalizedLibraryFilter))
      )
    : documents;
  const libraryDocuments = filteredDocuments.slice(0, 6);
  const readyDocuments = documents.filter((document) => document.status === "ready").length;
  const processingDocuments = documents.filter((document) => document.status === "processing" || document.status === "uploaded").length;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="title-rule font-heading text-2xl font-semibold text-ink">Dashboard Overview</h2>
          <p className="mt-1 text-sm text-subtle">Manage your document library and recent analyses.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-11 items-center justify-center rounded border border-border bg-surface px-4 text-sm font-semibold text-ink transition hover:border-primary hover:text-primary"
            disabled={isLoading}
            onClick={() => void loadDocuments()}
            type="button"
          >
            Refresh
          </button>
          <Link className="inline-flex h-11 items-center justify-center rounded border border-primary bg-primary px-4 text-sm font-semibold text-white transition hover:bg-accent-strong" href="/documents">
            Upload Document
          </Link>
        </div>
      </section>

      {error ? (
        <section className="rounded border border-danger-line bg-danger-soft p-4 text-sm text-danger">
          {error}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
          {stats.slice(0, 3).map((stat) => {
            const Icon = stat.icon;
            return (
            <article key={stat.label} className="flex items-center justify-between rounded border border-border bg-surface p-5">
              <div>
                <p className="text-sm font-medium text-subtle">{stat.label}</p>
                <p className="mt-3 nums font-heading text-3xl font-semibold text-ink">{isLoading ? "..." : stat.value}</p>
                <p className="mt-1 text-xs text-subtle">{isLoading ? "Loading dashboard..." : stat.helper}</p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-contexta bg-accent-soft text-primary">
                <Icon className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
              </div>
            </article>
            );
          })}
        </div>

        <article className="rounded border border-border bg-surface p-5 lg:col-span-8">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-heading text-xl font-semibold text-ink">Recent Analyses</h3>
            <Link className="text-sm font-semibold text-primary hover:underline" href="/chat">
              Open Chat
            </Link>
          </div>
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-subtle">Loading recent analyses...</p>
            ) : recentDocuments.length > 0 ? (
              recentDocuments.map((document) => (
                <Link key={document.id} className="flex items-start gap-3 rounded p-3 transition hover:bg-muted" href={`/documents/${document.id}`}>
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-primary">
                    <FileText className="h-4 w-4" strokeWidth={2.1} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{document.filename}</p>
                    <p className="truncate text-sm text-subtle">
                      {document.chunk_count} indexed chunks available for grounded answers.
                    </p>
                  </div>
                  <span className="hidden shrink-0 text-xs text-subtle sm:inline">{formatDate(document.created_at)}</span>
                </Link>
              ))
            ) : (
              <p className="rounded bg-muted p-4 text-sm text-subtle">Upload a document to create your first analysis workspace.</p>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-12">
        <article className="rounded border border-border bg-surface lg:col-span-8">
          <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-heading text-xl font-semibold text-ink">Document Library</h3>
              <p className="mt-1 text-sm text-subtle">Track indexing status and open document intelligence.</p>
            </div>
            <label className="relative block w-full sm:max-w-xs">
              <span className="sr-only">Filter library</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" strokeWidth={2} aria-hidden="true" />
              <input
                className="h-9 w-full rounded border border-border bg-background px-9 text-sm placeholder:text-subtle focus:border-primary focus:outline-none"
                placeholder="Filter library..."
                type="search"
                value={libraryFilter}
                onChange={(event) => setLibraryFilter(event.target.value)}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-muted text-xs font-semibold text-subtle">
                <tr className="border-b border-border">
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Size</th>
                  <th className="px-4 py-3 font-semibold">Date Uploaded</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="px-5 py-6 text-subtle" colSpan={6}>Loading document library...</td>
                  </tr>
                ) : libraryDocuments.length > 0 ? (
                  libraryDocuments.map((document) => (
                    <tr key={document.id} className="border-b border-border transition last:border-0 hover:bg-muted">
                      <td className="max-w-[320px] truncate px-5 py-4 font-medium text-ink">
                        {document.filename}
                      </td>
                      <td className="px-4 py-4 text-subtle">{document.file_type.toUpperCase()}</td>
                      <td className="px-4 py-4 text-subtle">{formatBytes(document.file_size)}</td>
                      <td className="px-4 py-4 text-subtle">{formatDate(document.created_at)}</td>
                      <td className="px-4 py-4"><StatusPill status={statusForPill(document.status)} /></td>
                      <td className="px-5 py-4 text-right">
                        <Link className="font-semibold text-primary hover:underline" href={`/documents/${document.id}`}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-5 py-6" colSpan={6}>
                      <p className="font-semibold text-ink">{documents.length > 0 ? "No matching documents" : "No documents yet"}</p>
                      <p className="mt-1 text-sm text-subtle">
                        {documents.length > 0 ? "Try another filename, type, or status." : "Upload a PDF or DOCX to start building your searchable knowledge base."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border bg-background px-5 py-3 text-sm text-subtle">
            <span>Showing {isLoading ? "..." : `${libraryDocuments.length} of ${filteredDocuments.length}`}</span>
            <Link className="font-semibold text-primary hover:underline" href="/documents">
              View all
            </Link>
          </div>
        </article>

        <aside className="space-y-4 lg:col-span-4">
          <article className="rounded border border-border bg-surface p-5">
            <h3 className="font-heading text-xl font-semibold text-ink">Workspace Health</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className={`rounded px-3 py-2 ${indexingHealth?.status === "attention" ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span>Indexing health</span>
                  <span className="font-semibold">{indexingHealthLabel(indexingHealth)}</span>
                </div>
                <p className="mt-1 text-xs">{indexingHealthDetail(indexingHealth)}</p>
              </div>
              <div className="flex items-center justify-between rounded bg-muted px-3 py-2">
                <span className="text-subtle">Ready documents</span>
                <span className="font-semibold text-ink">{isLoading ? "..." : readyDocuments}</span>
              </div>
              <div className="flex items-center justify-between rounded bg-muted px-3 py-2">
                <span className="text-subtle">In queue</span>
                <span className="font-semibold text-ink">{isLoading ? "..." : processingDocuments}</span>
              </div>
              <div className="flex items-center justify-between rounded bg-muted px-3 py-2">
                <span className="text-subtle">Indexed chunks</span>
                <span className="font-semibold text-ink">{isLoading ? "..." : stats[3].value}</span>
              </div>
            </div>
          </article>

          <article className="rounded border border-border bg-surface p-5">
            <h3 className="font-heading text-xl font-semibold text-ink">Next Actions</h3>
            <div className="mt-4 space-y-3">
              <Link className="block rounded border border-border px-4 py-3 text-sm font-semibold transition hover:border-primary hover:bg-muted" href="/documents">
                Upload or manage documents
              </Link>
              <Link className="block rounded border border-border px-4 py-3 text-sm font-semibold transition hover:border-primary hover:bg-muted" href="/chat">
                Ask questions with citations
              </Link>
              <Link className="block rounded border border-border px-4 py-3 text-sm font-semibold transition hover:border-primary hover:bg-muted" href="/settings">
                Review local RAG settings
              </Link>
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
