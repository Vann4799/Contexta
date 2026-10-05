"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Clock,
  Database,
  Files,
  HardDrive,
  Layers,
  MessageSquare,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Upload,
  type LucideIcon
} from "lucide-react";
import { getIndexingHealth, listDocuments, type DocumentItem, type DocumentStatus, type IndexingHealth } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";

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

  const totals = useMemo(() => {
    const ready = documents.filter((document) => document.status === "ready").length;
    const queued = documents.length - ready;
    const chunks = documents.reduce((sum, document) => sum + document.chunk_count, 0);
    const storage = documents.reduce((sum, document) => sum + document.file_size, 0);

    return { ready, queued, chunks, storage };
  }, [documents]);

  const recentDocuments = documents.slice(0, 3);
  const normalizedLibraryFilter = libraryFilter.trim().toLowerCase();
  const filteredDocuments = normalizedLibraryFilter
    ? documents.filter((document) =>
        [document.filename, document.file_type, document.status].some((value) =>
          value.toLowerCase().includes(normalizedLibraryFilter)
        )
      )
    : documents;
  const libraryDocuments = filteredDocuments.slice(0, 6);

  const stats: Array<{ label: string; value: string; icon: LucideIcon }> = [
    { label: "Documents", value: String(documents.length), icon: Files },
    { label: "Ready", value: String(totals.ready), icon: Database },
    { label: "In queue", value: String(totals.queued), icon: Clock },
    { label: "Chunks", value: String(totals.chunks), icon: Layers },
    { label: "Storage", value: formatBytes(totals.storage), icon: HardDrive }
  ];

  return (
    <div className="flex flex-col gap-3">
      <section className="surface flex flex-col gap-7 px-5 py-6 lg:flex-row lg:items-start lg:gap-9 lg:px-7">
        <div className="flex shrink-0 items-center gap-4 lg:w-[340px]">
          <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-night shadow-root">
            <Database className="h-7 w-7 text-accent" strokeWidth={2.2} aria-hidden="true" />
            <span
              className={cn(
                "absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white",
                indexingHealth?.status === "attention" ? "bg-danger" : "animate-pulse-dot bg-accent"
              )}
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="eyebrow">Knowledge index</span>
              <span className="rounded bg-accent px-1.5 py-[1px] text-[10px] font-bold tracking-[0.08em] text-ink">
                {indexingHealth?.status === "attention" ? "ATTENTION" : "SYNCED"}
              </span>
            </div>
            <h2 className="mt-1 truncate text-[22px] font-semibold leading-tight tracking-tight">Document workspace</h2>
            <p className="mt-0.5 truncate font-mono text-[12px] text-ink-muted">
              {indexingHealth ? `stale > ${indexingHealth.stale_after_minutes} min` : "index health unknown"}
            </p>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 xl:grid-cols-5">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="eyebrow">{stat.label}</dt>
                <dd className="mt-1 nums text-[30px] font-semibold leading-none tracking-tight">
                  {isLoading ? "—" : stat.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button disabled={isLoading} onClick={() => void loadDocuments()} variant="secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
            <Link
              className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-control bg-night px-4 text-[13.5px] font-medium leading-none text-white shadow-node transition-colors hover:bg-night-raised"
              href="/documents"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload document
            </Link>
            <Link
              className="focus-ring ml-auto inline-flex h-10 items-center gap-1.5 rounded-control px-3 text-[13.5px] font-medium text-ink-muted transition-colors hover:bg-paper-chip hover:text-ink"
              href="/convert"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Convert
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-card border border-danger-line bg-danger-soft px-5 py-4 text-[13.5px] text-danger">
          {error}
        </section>
      ) : null}

      <section className="grid gap-3 lg:grid-cols-12">
        <article className="surface min-w-0 p-5 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[17px] font-semibold tracking-tight">Document library</h3>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">Indexing status across every uploaded file.</p>
            </div>
            <label className="relative block w-full sm:max-w-[220px]">
              <span className="sr-only">Filter library</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                strokeWidth={2}
                aria-hidden="true"
              />
              <input
                className="focus-ring h-9 w-full rounded-control border border-paper-line bg-paper-soft pl-9 pr-3 text-[13px] placeholder:text-ink-faint"
                placeholder="Filter by name, type, status"
                type="search"
                value={libraryFilter}
                onChange={(event) => setLibraryFilter(event.target.value)}
              />
            </label>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-paper-line">
                  <th className="eyebrow px-3 py-2 font-semibold">Name</th>
                  <th className="eyebrow px-3 py-2 font-semibold">Type</th>
                  <th className="eyebrow px-3 py-2 font-semibold">Size</th>
                  <th className="eyebrow px-3 py-2 font-semibold">Uploaded</th>
                  <th className="eyebrow px-3 py-2 font-semibold">Status</th>
                  <th className="eyebrow px-3 py-2 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="px-3 py-6 text-ink-muted" colSpan={6}>
                      Loading document library...
                    </td>
                  </tr>
                ) : libraryDocuments.length > 0 ? (
                  libraryDocuments.map((document) => (
                    <tr key={document.id} className="border-b border-paper-line/60 last:border-0">
                      <td className="max-w-[260px] truncate px-3 py-3 font-medium">{document.filename}</td>
                      <td className="px-3 py-3 font-mono text-[11.5px] uppercase text-ink-muted">{document.file_type}</td>
                      <td className="nums px-3 py-3 text-ink-muted">{formatBytes(document.file_size)}</td>
                      <td className="nums px-3 py-3 text-ink-muted">{formatDate(document.created_at)}</td>
                      <td className="px-3 py-3">
                        <StatusPill status={statusForPill(document.status)} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          className="inline-flex items-center gap-1 font-medium text-ink hover:underline"
                          href={`/documents/${document.id}`}
                        >
                          Open
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-6" colSpan={6}>
                      <p className="font-medium">
                        {documents.length > 0 ? "No matching documents" : "No documents yet"}
                      </p>
                      <p className="mt-1 text-[12.5px] text-ink-muted">
                        {documents.length > 0
                          ? "Try another filename, type, or status."
                          : "Upload a PDF or DOCX to start building your searchable knowledge base."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-paper-line pt-3 text-[12.5px] text-ink-muted">
            <span className="nums">
              Showing {isLoading ? "—" : `${libraryDocuments.length} of ${filteredDocuments.length}`}
            </span>
            <Link className="inline-flex items-center gap-1 font-medium text-ink hover:underline" href="/documents">
              View all
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </article>

        <div className="flex min-w-0 flex-col gap-3 lg:col-span-4">
          <article className="surface p-5">
            <h3 className="text-[17px] font-semibold tracking-tight">Recent analyses</h3>
            <div className="mt-3 flex flex-col gap-1">
              {isLoading ? (
                <p className="text-[12.5px] text-ink-muted">Loading recent analyses...</p>
              ) : recentDocuments.length > 0 ? (
                recentDocuments.map((document) => (
                  <Link
                    key={document.id}
                    className="focus-ring flex items-start gap-3 rounded-control px-2 py-2 transition-colors hover:bg-paper-chip"
                    href={`/documents/${document.id}`}
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-control bg-night text-accent">
                      <Files className="h-4 w-4" strokeWidth={2.1} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{document.filename}</span>
                      <span className="nums block truncate text-[12px] text-ink-muted">
                        {document.chunk_count} chunks · {formatDate(document.created_at)}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <p className="rounded-control bg-paper-chip px-3 py-2.5 text-[12.5px] text-ink-muted">
                  Upload a document to create your first analysis workspace.
                </p>
              )}
            </div>
          </article>

          <article className="surface p-5">
            <h3 className="text-[17px] font-semibold tracking-tight">Workspace health</h3>
            <dl className="mt-3 flex flex-col gap-2 text-[13px]">
              <div
                className={cn(
                  "rounded-control px-3 py-2",
                  indexingHealth?.status === "attention"
                    ? "bg-warning-soft text-warning"
                    : "bg-success-soft text-success-ink"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span>Indexing health</span>
                  <span className="font-semibold">
                    {indexingHealth ? (indexingHealth.status === "attention" ? "Needs attention" : "Active") : "Unknown"}
                  </span>
                </div>
                <p className="mt-0.5 text-[11.5px]">
                  {indexingHealth
                    ? indexingHealth.status === "attention"
                      ? `${indexingHealth.stale_processing_documents} stale for ${indexingHealth.stale_after_minutes}+ min`
                      : indexingHealth.queued_documents > 0
                        ? `${indexingHealth.queued_documents} queued`
                        : "No stale jobs"
                    : "Indexing health could not be inferred."}
                </p>
              </div>
              {[
                { label: "Ready documents", value: totals.ready },
                { label: "In queue", value: totals.queued },
                { label: "Indexed chunks", value: totals.chunks }
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-control bg-paper-chip px-3 py-2">
                  <dt className="text-ink-muted">{row.label}</dt>
                  <dd className="nums font-semibold">{isLoading ? "—" : row.value}</dd>
                </div>
              ))}
            </dl>
          </article>

          <article className="surface p-5">
            <h3 className="text-[17px] font-semibold tracking-tight">Next actions</h3>
            <div className="mt-3 flex flex-col gap-2">
              {[
                { href: "/documents", label: "Upload or manage documents", icon: Upload },
                { href: "/chat", label: "Ask questions with citations", icon: MessageSquare },
                { href: "/settings", label: "Review retrieval settings", icon: SlidersHorizontal }
              ].map((action) => (
                <Link
                  key={action.href}
                  className="focus-ring flex items-center gap-2.5 rounded-control border border-paper-line bg-paper-soft px-3 py-2.5 text-[13px] font-medium transition-colors hover:bg-paper-card"
                  href={action.href}
                >
                  <action.icon className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{action.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-ink-faint" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
