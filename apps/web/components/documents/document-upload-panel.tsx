"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CloudUpload } from "lucide-react";
import {
  deleteDocument,
  getIndexingHealth,
  retryDocument,
  uploadDocument,
  listDocuments,
  type DocumentItem,
  type DocumentStatus,
  type IndexingHealth
} from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";

const allowedExtensions = new Set(["pdf", "docx"]);
const maxUploadBytes = 50 * 1024 * 1024;
const missingConfigMessage = "Document uploads are not configured yet. Please contact an administrator.";

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

function getExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function uploadErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  if (error.message.includes("NEXT_PUBLIC_SUPABASE_")) {
    return missingConfigMessage;
  }

  return error.message;
}

function indexingHealthLabel(health: IndexingHealth | null) {
  if (!health) {
    return "Indexing health: unknown";
  }

  if (health.status === "attention") {
    return "Indexing health: needs attention";
  }

  return "Indexing health: active";
}

function indexingHealthDetail(health: IndexingHealth | null) {
  if (!health) {
    return "Unable to infer worker health yet.";
  }

  if (health.status === "attention") {
    return `${health.stale_processing_documents} processing file${health.stale_processing_documents === 1 ? "" : "s"} stale for ${health.stale_after_minutes}+ minutes.`;
  }

  if (health.queued_documents > 0) {
    return `${health.queued_documents} queued file${health.queued_documents === 1 ? "" : "s"} waiting to start.`;
  }

  if (health.processing_documents > 0) {
    return `${health.processing_documents} file${health.processing_documents === 1 ? "" : "s"} currently processing.`;
  }

  return "No stale indexing jobs detected.";
}

export function DocumentUploadPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mutatingDocumentId, setMutatingDocumentId] = useState<string | null>(null);
  const [indexingHealth, setIndexingHealth] = useState<IndexingHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAllDocuments, setShowAllDocuments] = useState(false);

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
        setError("Sign in to view and upload documents.");
        return;
      }

      setDocuments(await listDocuments(accessToken));
    } catch (loadError) {
      setError(uploadErrorMessage(loadError, "Unable to load documents."));
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const hasProcessingDocument = documents.some((document) => document.status === "uploaded" || document.status === "processing");
    if (!hasProcessingDocument) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadDocuments();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [documents, loadDocuments]);

  const handleUpload = async (file: File) => {
    setError(null);
    setSuccess(null);

    if (!allowedExtensions.has(getExtension(file.name))) {
      setError("Only PDF and DOCX files are supported.");
      return;
    }

    if (file.size === 0) {
      setError("The selected file is empty.");
      return;
    }

    if (file.size > maxUploadBytes) {
      setError("Files must be 50 MB or smaller.");
      return;
    }

    setIsUploading(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("Sign in to view and upload documents.");
        return;
      }

      const uploadedDocument = await uploadDocument(accessToken, file);
      setDocuments((currentDocuments) => [uploadedDocument, ...currentDocuments]);
      try {
        setIndexingHealth(await getIndexingHealth());
      } catch {
        setIndexingHealth(null);
      }
      setSuccess(`${uploadedDocument.filename} uploaded.`);
    } catch (uploadError) {
      setError(uploadErrorMessage(uploadError, "Unable to upload document."));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (document: DocumentItem) => {
    setError(null);
    setSuccess(null);

    if (!window.confirm(`Delete "${document.filename}"? This removes its indexed chunks too.`)) {
      return;
    }

    setMutatingDocumentId(document.id);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("Sign in to delete documents.");
        return;
      }

      await deleteDocument(accessToken, document.id);
      setDocuments((currentDocuments) => currentDocuments.filter((currentDocument) => currentDocument.id !== document.id));
      setSuccess(`${document.filename} deleted.`);
    } catch (deleteError) {
      setError(uploadErrorMessage(deleteError, "Unable to delete document."));
    } finally {
      setMutatingDocumentId(null);
    }
  };

  const handleRetry = async (document: DocumentItem) => {
    setError(null);
    setSuccess(null);
    setMutatingDocumentId(document.id);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("Sign in to retry documents.");
        return;
      }

      const retriedDocument = await retryDocument(accessToken, document.id);
      setDocuments((currentDocuments) => currentDocuments.map((currentDocument) => (currentDocument.id === document.id ? retriedDocument : currentDocument)));
      setSuccess(`${document.filename} queued for retry.`);
    } catch (retryError) {
      setError(uploadErrorMessage(retryError, "Unable to retry document."));
    } finally {
      setMutatingDocumentId(null);
    }
  };

  const totalStorage = documents.reduce((sum, document) => sum + document.file_size, 0);
  const queueCount = documents.filter((document) => document.status === "uploaded" || document.status === "processing").length;
  const readyCount = documents.filter((document) => document.status === "ready").length;
  const recentActivityLimit = 5;
  const visibleDocuments = showAllDocuments ? documents : documents.slice(0, recentActivityLimit);

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-heading text-3xl font-semibold text-ink">Upload & Manage</h2>
          <p className="mt-1 text-sm text-subtle">Add new documents to your knowledge base. Supported formats: PDF and DOCX.</p>
        </div>
        <div className="flex gap-2">
          <Button disabled={isLoading || isUploading} onClick={() => void loadDocuments()} variant="secondary">
            Refresh
          </Button>
          <Button disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
            {isUploading ? "Uploading..." : "Browse Files"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div
          className={`flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded border border-dashed p-8 text-center transition ${
            isDragging ? "border-primary bg-muted" : "border-border bg-surface hover:bg-muted"
          } lg:col-span-8`}
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) {
              void handleUpload(file);
            }
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={isUploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleUpload(file);
              }
            }}
          />
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-contexta bg-accent-soft text-primary">
            <CloudUpload className="h-7 w-7" strokeWidth={2.2} aria-hidden="true" />
          </div>
          <h3 className="font-heading text-xl font-semibold text-ink">Drag and drop files here</h3>
          <p className="mt-2 max-w-md text-sm text-subtle">Files will be securely uploaded and automatically indexed for RAG analysis.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <span className="inline-flex h-10 items-center justify-center rounded border border-border bg-surface px-5 text-sm font-semibold text-ink">
              Browse Files
            </span>
            <span className="text-sm text-subtle">PDF or DOCX, max 50 MB</span>
          </div>
        </div>

        <aside className="flex rounded border border-border bg-background p-5 lg:col-span-4">
          <div className="flex w-full flex-col gap-4">
            <h3 className="text-xs font-semibold text-subtle">System Status</h3>
            <div className="flex items-center justify-between rounded border border-border bg-surface p-3 text-sm">
              <span className="font-medium text-ink">Storage Used</span>
              <span className="font-mono text-xs text-ink">{formatBytes(totalStorage)}</span>
            </div>
            <div className="flex items-center justify-between rounded border border-border bg-surface p-3 text-sm">
              <span className="font-medium text-ink">Indexing Queue</span>
              <span className="font-mono text-xs text-ink">{indexingHealth?.queued_documents ?? queueCount} file{(indexingHealth?.queued_documents ?? queueCount) === 1 ? "" : "s"}</span>
            </div>
            <div className={`rounded border p-3 text-sm ${indexingHealth?.status === "attention" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
              <p className="font-semibold">{indexingHealthLabel(indexingHealth)}</p>
              <p className="mt-1 text-xs">{indexingHealthDetail(indexingHealth)}</p>
            </div>
            <div className="flex items-center justify-between rounded border border-border bg-surface p-3 text-sm">
              <span className="font-medium text-ink">Ready</span>
              <span className="font-mono text-xs text-ink">{readyCount} file{readyCount === 1 ? "" : "s"}</span>
            </div>
            <div className="mt-auto rounded border border-accent-soft bg-accent-soft p-3 text-sm text-subtle">
              Large PDFs may take up to 2 minutes to fully index for vector search.
            </div>
          </div>
        </aside>
      </div>

      <div className="text-sm">
        {isLoading ? <p className="rounded border border-border bg-surface p-3 text-subtle">Loading documents...</p> : null}
        {isUploading ? <p className="rounded border border-border bg-surface p-3 text-subtle">Uploading document...</p> : null}
        {success ? <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">{success}</p> : null}
        {error ? <p className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</p> : null}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-heading text-xl font-semibold text-ink">Recent Activity</h3>
          {documents.length > recentActivityLimit ? (
            <button className="text-sm font-semibold text-primary hover:underline" disabled={isLoading} onClick={() => setShowAllDocuments((current) => !current)} type="button">
              {showAllDocuments ? "Show Recent" : "View All"}
            </button>
          ) : null}
        </div>
        <div className="overflow-hidden rounded border border-border bg-surface">
          <div className="grid min-w-[760px] grid-cols-12 border-b border-border bg-muted px-5 py-3 text-xs font-semibold text-subtle">
            <div className="col-span-6">File Name</div>
            <div className="col-span-2">Size</div>
            <div className="col-span-3">Status</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[760px] divide-y divide-border">
              {visibleDocuments.length > 0 ? (
                visibleDocuments.map((document) => (
                  <div key={document.id} className="grid grid-cols-12 items-center gap-3 px-5 py-4 transition hover:bg-background">
                    <div className="col-span-6 flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-accent-soft text-primary">
                        <span className="text-xs font-bold">{document.file_type.toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <Link className="block truncate font-medium text-ink hover:text-primary hover:underline" href={`/documents/${document.id}`}>
                          {document.filename}
                        </Link>
                        {document.status === "failed" && document.error_message ? (
                          <p className="truncate text-xs text-red-700" title={document.error_message}>
                            {document.error_message}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="col-span-2 font-mono text-xs text-subtle">{formatBytes(document.file_size)}</div>
                    <div className="col-span-3">
                      <StatusPill status={statusForPill(document.status)} />
                    </div>
                    <div className="col-span-1 flex justify-end gap-2">
                      {document.status === "failed" ? (
                        <Button
                          disabled={mutatingDocumentId === document.id}
                          onClick={() => void handleRetry(document)}
                          variant="secondary"
                        >
                          Retry
                        </Button>
                      ) : null}
                      <Button
                        disabled={mutatingDocumentId === document.id}
                        onClick={() => void handleDelete(document)}
                        variant="ghost"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-5 py-10 text-center text-sm text-subtle">
                  {isLoading ? "Loading documents..." : "No documents uploaded yet."}
                </div>
              )}
            </div>
          </div>
          {documents.length > recentActivityLimit ? (
            <div className="border-t border-border bg-background px-5 py-3 text-xs text-subtle">
              Showing {visibleDocuments.length} of {documents.length} documents.
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}
