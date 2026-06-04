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

    return [
      { label: "Total Documents", value: documents.length.toString(), helper: `${readyDocuments} ready` },
      { label: "Processing", value: processingDocuments.toString(), helper: "Uploads being indexed" },
      { label: "Indexed Chunks", value: totalChunks.toString(), helper: "Searchable text blocks" }
    ];
  }, [documents]);

  const recentDocuments = documents.slice(0, 4);

  return (
    <div className="space-y-6">
      {error ? (
        <section className="rounded-contexta border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-contexta border border-border bg-white p-5">
            <p className="text-sm text-subtle">{stat.label}</p>
            <p className="mt-2 font-heading text-3xl font-semibold">{isLoading ? "..." : stat.value}</p>
            <p className="mt-1 text-xs text-subtle">{isLoading ? "Loading dashboard..." : stat.helper}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-contexta border border-border bg-white lg:col-span-2">
          <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-heading text-lg font-semibold">Recent Documents</h2>
              <p className="mt-1 text-sm text-subtle">Track indexing status and jump into document intelligence.</p>
            </div>
            <Link className="inline-flex h-10 items-center justify-center rounded border border-primary bg-primary px-4 text-sm font-medium text-white hover:bg-blue-700" href="/documents">
              Upload Document
            </Link>
          </div>

          <div className="divide-y divide-border">
            {isLoading ? (
              <p className="p-5 text-sm text-subtle">Loading recent documents...</p>
            ) : recentDocuments.length > 0 ? (
              recentDocuments.map((document) => (
                <Link key={document.id} className="block p-5 transition hover:bg-muted" href={`/documents/${document.id}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{document.filename}</p>
                      <p className="mt-1 text-sm text-subtle">
                        {document.file_type.toUpperCase()} - {formatBytes(document.file_size)} - {document.chunk_count} chunks - {formatDate(document.created_at)}
                      </p>
                    </div>
                    <StatusPill status={statusForPill(document.status)} />
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-5">
                <p className="font-medium">No documents yet</p>
                <p className="mt-1 text-sm text-subtle">Upload a PDF or DOCX to start building your searchable knowledge base.</p>
              </div>
            )}
          </div>
        </article>

        <aside className="rounded-contexta border border-border bg-white p-5">
          <h2 className="font-heading text-lg font-semibold">Next Actions</h2>
          <div className="mt-4 space-y-3">
            <Link className="block rounded border border-border px-4 py-3 text-sm font-medium hover:border-primary hover:bg-muted" href="/documents">
              Upload or manage documents
            </Link>
            <Link className="block rounded border border-border px-4 py-3 text-sm font-medium hover:border-primary hover:bg-muted" href="/chat">
              Ask questions with citations
            </Link>
            <Link className="block rounded border border-border px-4 py-3 text-sm font-medium hover:border-primary hover:bg-muted" href="/settings">
              Review local RAG settings
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
