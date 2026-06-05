"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listDocuments, type DocumentItem, type DocumentStatus } from "@/lib/api";
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

export function DashboardInsights() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
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
      { label: "Total Documents", value: documents.length.toString(), helper: `${readyDocuments} ready`, icon: "M4 6h16v14H4V6Zm2 2v10h12V8H6Zm2-4h8v2H8V4Z" },
      { label: "Processing", value: processingDocuments.toString(), helper: "Uploads being indexed", icon: "M12 4a8 8 0 0 1 7.4 5H17a6 6 0 1 0-1.2 6.4l1.4 1.4A8 8 0 1 1 12 4Zm4 3h5v5h-2V9.8l-3.1 3.1-1.4-1.4L17.6 8H16V7Z" },
      { label: "Storage Used", value: formatBytes(totalStorage), helper: "Document file size", icon: "M7 18a5 5 0 0 1 1-9.9A6 6 0 0 1 19.7 11 4 4 0 0 1 19 19H7v-1Zm0-8a3 3 0 1 0 0 6h12a2 2 0 0 0 .1-4H18l-.3-1.1A4 4 0 0 0 10 10.1L9.6 12H7Z" },
      { label: "Indexed Chunks", value: totalChunks.toString(), helper: "Searchable text blocks", icon: "M5 4h14v3H5V4Zm0 5h14v3H5V9Zm0 5h14v6H5v-6Zm2 2v2h10v-2H7Z" }
    ];
  }, [documents]);

  const recentDocuments = documents.slice(0, 3);
  const libraryDocuments = documents.slice(0, 6);
  const readyDocuments = documents.filter((document) => document.status === "ready").length;
  const processingDocuments = documents.filter((document) => document.status === "processing" || document.status === "uploaded").length;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-ink">Dashboard Overview</h2>
          <p className="mt-1 text-sm text-subtle">Manage your document library and recent analyses.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-11 items-center justify-center rounded border border-[#c3c6d7] bg-white px-4 text-sm font-semibold text-ink transition hover:border-primary hover:text-primary"
            disabled={isLoading}
            onClick={() => void loadDocuments()}
            type="button"
          >
            Refresh
          </button>
          <Link className="inline-flex h-11 items-center justify-center rounded border border-primary bg-primary px-4 text-sm font-semibold text-white transition hover:bg-blue-700" href="/documents">
            Upload Document
          </Link>
        </div>
      </section>

      {error ? (
        <section className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
          {stats.slice(0, 3).map((stat) => (
            <article key={stat.label} className="flex items-center justify-between rounded border border-[#c3c6d7] bg-white p-5">
              <div>
                <p className="text-sm font-medium text-subtle">{stat.label}</p>
                <p className="mt-3 font-heading text-3xl font-semibold text-ink">{isLoading ? "..." : stat.value}</p>
                <p className="mt-1 text-xs text-subtle">{isLoading ? "Loading dashboard..." : stat.helper}</p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-[#dbe1ff] text-primary">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d={stat.icon} />
                </svg>
              </div>
            </article>
          ))}
        </div>

        <article className="rounded border border-[#c3c6d7] bg-white p-5 lg:col-span-8">
          <div className="mb-4 flex items-center justify-between border-b border-[#c3c6d7] pb-3">
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
                <Link key={document.id} className="flex items-start gap-3 rounded p-3 transition hover:bg-[#f0f3ff]" href={`/documents/${document.id}`}>
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dce2f3] text-primary">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M4 5h16v11H8l-4 4V5Zm2 2v8.2L7.2 14H18V7H6Zm3 3h8v2H9v-2Z" />
                    </svg>
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
              <p className="rounded bg-[#f0f3ff] p-4 text-sm text-subtle">Upload a document to create your first analysis workspace.</p>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-12">
        <article className="rounded border border-[#c3c6d7] bg-white lg:col-span-8">
          <div className="flex flex-col gap-3 border-b border-[#c3c6d7] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-heading text-xl font-semibold text-ink">Document Library</h3>
              <p className="mt-1 text-sm text-subtle">Track indexing status and open document intelligence.</p>
            </div>
            <label className="relative block w-full sm:max-w-xs">
              <span className="sr-only">Filter library</span>
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m20 20-4-4m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                className="h-9 w-full rounded border border-[#c3c6d7] bg-[#f9f9ff] px-9 text-sm placeholder:text-subtle focus:border-primary focus:outline-none"
                placeholder="Filter library..."
                type="search"
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-[#f0f3ff] text-xs font-semibold uppercase text-subtle">
                <tr className="border-b border-[#c3c6d7]">
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
                    <tr key={document.id} className="border-b border-[#dce2f3] transition last:border-0 hover:bg-[#f0f3ff]">
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
                      <p className="font-semibold text-ink">No documents yet</p>
                      <p className="mt-1 text-sm text-subtle">Upload a PDF or DOCX to start building your searchable knowledge base.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[#c3c6d7] bg-[#f9f9ff] px-5 py-3 text-sm text-subtle">
            <span>Showing {isLoading ? "..." : `1-${Math.min(libraryDocuments.length, documents.length)} of ${documents.length}`}</span>
            <Link className="font-semibold text-primary hover:underline" href="/documents">
              View all
            </Link>
          </div>
        </article>

        <aside className="space-y-4 lg:col-span-4">
          <article className="rounded border border-[#c3c6d7] bg-white p-5">
            <h3 className="font-heading text-xl font-semibold text-ink">Workspace Health</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded bg-[#f0f3ff] px-3 py-2">
                <span className="text-subtle">Ready documents</span>
                <span className="font-semibold text-ink">{isLoading ? "..." : readyDocuments}</span>
              </div>
              <div className="flex items-center justify-between rounded bg-[#f0f3ff] px-3 py-2">
                <span className="text-subtle">In queue</span>
                <span className="font-semibold text-ink">{isLoading ? "..." : processingDocuments}</span>
              </div>
              <div className="flex items-center justify-between rounded bg-[#f0f3ff] px-3 py-2">
                <span className="text-subtle">Indexed chunks</span>
                <span className="font-semibold text-ink">{isLoading ? "..." : stats[3].value}</span>
              </div>
            </div>
          </article>

          <article className="rounded border border-[#c3c6d7] bg-white p-5">
            <h3 className="font-heading text-xl font-semibold text-ink">Next Actions</h3>
            <div className="mt-4 space-y-3">
              <Link className="block rounded border border-[#dce2f3] px-4 py-3 text-sm font-semibold transition hover:border-primary hover:bg-[#f0f3ff]" href="/documents">
                Upload or manage documents
              </Link>
              <Link className="block rounded border border-[#dce2f3] px-4 py-3 text-sm font-semibold transition hover:border-primary hover:bg-[#f0f3ff]" href="/chat">
                Ask questions with citations
              </Link>
              <Link className="block rounded border border-[#dce2f3] px-4 py-3 text-sm font-semibold transition hover:border-primary hover:bg-[#f0f3ff]" href="/settings">
                Review local RAG settings
              </Link>
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
