"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CloudUpload, RefreshCw, Upload } from "lucide-react";
import {
  deleteDocument,
  getIndexingHealth,
  retryDocument,
  uploadDocument,
  DOCUMENT_TYPE_LABELS,
  listDocuments,
  type DocumentItem,
  type DocumentStatus,
  type DocumentType,
  type IndexingHealth
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";

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
  const [docType, setDocType] = useState<DocumentType>("unclassified");

  const getAccessToken = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
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

      const uploadedDocument = await uploadDocument(accessToken, file, docType);
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
    <section className="flex flex-col gap-3">
      <div className="surface flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-end sm:justify-between lg:px-7">
        <div className="min-w-0">
          <p className="eyebrow">Knowledge base</p>
          <h2 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight">Upload &amp; manage</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            Add documents to the index. Supported formats: PDF and DOCX.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-end gap-2">
          <label className="grid gap-1.5 text-[12px] font-semibold text-ink-muted">
            Document type
            <select
              aria-label="Document type"
              className="focus-ring h-9 rounded-control border border-paper-line bg-paper-soft px-3 text-[13px] font-normal text-ink outline-none"
              disabled={isUploading}
              onChange={(event) => setDocType(event.target.value as DocumentType)}
              value={docType}
            >
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={isLoading || isUploading} onClick={() => void loadDocuments()} variant="secondary">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
          <Button disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            {isUploading ? "Uploading..." : "Browse files"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        <div
          className={cn(
            "focus-ring flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-card border border-dashed p-8 text-center shadow-card transition-colors lg:col-span-8",
            isDragging
              ? "border-ink bg-paper-chip"
              : "border-paper-edge bg-paper-card hover:border-ink/40 hover:bg-paper-soft"
          )}
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
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-night shadow-root">
            <CloudUpload className="h-7 w-7 text-accent" strokeWidth={2.2} aria-hidden="true" />
          </div>
          <h3 className="text-[19px] font-semibold tracking-tight">Drag and drop files here</h3>
          <p className="mt-2 max-w-md text-[13px] text-ink-muted">
            Files are uploaded to your workspace and indexed automatically for grounded answers.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <span className="inline-flex h-10 items-center justify-center rounded-control bg-accent px-5 text-[13.5px] font-medium text-ink shadow-node">
              Browse files
            </span>
            <span className="chip">PDF or DOCX · max 50 MB</span>
          </div>
        </div>

        <aside className="surface flex p-5 lg:col-span-4">
          <div className="flex w-full flex-col gap-2.5">
            <p className="eyebrow">System status</p>
            <div className="flex items-center justify-between rounded-control bg-paper-chip px-3 py-2 text-[13px]">
              <span className="text-ink-muted">Storage used</span>
              <span className="nums font-semibold">{formatBytes(totalStorage)}</span>
            </div>
            <div className="flex items-center justify-between rounded-control bg-paper-chip px-3 py-2 text-[13px]">
              <span className="text-ink-muted">Indexing queue</span>
              <span className="nums font-semibold">
                {indexingHealth?.queued_documents ?? queueCount} file{(indexingHealth?.queued_documents ?? queueCount) === 1 ? "" : "s"}
              </span>
            </div>
            <div
              className={cn(
                "rounded-control px-3 py-2 text-[13px]",
                indexingHealth?.status === "attention" ? "bg-warning-soft text-warning" : "bg-success-soft text-success-ink"
              )}
            >
              <p className="font-semibold">{indexingHealthLabel(indexingHealth)}</p>
              <p className="mt-0.5 text-[11.5px]">{indexingHealthDetail(indexingHealth)}</p>
            </div>
            <div className="flex items-center justify-between rounded-control bg-paper-chip px-3 py-2 text-[13px]">
              <span className="text-ink-muted">Ready</span>
              <span className="nums font-semibold">{readyCount} file{readyCount === 1 ? "" : "s"}</span>
            </div>
            <p className="mt-auto rounded-control border border-paper-line px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
              Large PDFs may take up to 2 minutes to fully index for vector search.
            </p>
          </div>
        </aside>
      </div>

      <div className="flex flex-col gap-2 text-[13px]">
        {isLoading ? <p className="chip w-fit">Loading documents...</p> : null}
        {isUploading ? <p className="chip w-fit">Uploading document...</p> : null}
        {success ? (
          <p className="rounded-control bg-success-soft px-3 py-2 text-success-ink" role="status">
            {success}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-control bg-danger-soft px-3 py-2 text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <section className="surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Activity</p>
            <h3 className="mt-1 text-[17px] font-semibold tracking-tight">Recent documents</h3>
          </div>
          {documents.length > recentActivityLimit ? (
            <Button disabled={isLoading} onClick={() => setShowAllDocuments((current) => !current)} variant="ghost">
              {showAllDocuments ? "Show recent" : "View all"}
            </Button>
          ) : null}
        </div>

        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-12 gap-3 border-b border-paper-line pb-2">
              <div className="eyebrow col-span-6">File name</div>
              <div className="eyebrow col-span-2">Size</div>
              <div className="eyebrow col-span-3">Status</div>
              <div className="eyebrow col-span-1 text-right">Actions</div>
            </div>
            <div>
              {visibleDocuments.length > 0 ? (
                visibleDocuments.map((document) => (
                  <div
                    key={document.id}
                    className="grid grid-cols-12 items-center gap-3 border-b border-paper-line/60 py-3 last:border-0"
                  >
                    <div className="col-span-6 flex min-w-0 items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-night">
                        <span className="font-mono text-[9.5px] font-bold tracking-[0.06em] text-accent">
                          {document.file_type.toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <Link
                          className="block truncate text-[13.5px] font-medium hover:underline"
                          href={`/documents/${document.id}`}
                        >
                          {document.filename}
                        </Link>
                        {document.status === "failed" && document.error_message ? (
                          <p className="truncate text-[11.5px] text-danger" title={document.error_message}>
                            {document.error_message}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="nums col-span-2 text-[12.5px] text-ink-muted">{formatBytes(document.file_size)}</div>
                    <div className="col-span-3">
                      <StatusPill status={statusForPill(document.status)} />
                    </div>
                    <div className="col-span-1 flex justify-end gap-1">
                      {document.status === "failed" ? (
                        <Button
                          className="h-8 px-2.5 text-[12.5px]"
                          disabled={mutatingDocumentId === document.id}
                          onClick={() => void handleRetry(document)}
                          variant="secondary"
                        >
                          Retry
                        </Button>
                      ) : null}
                      <Button
                        className="h-8 px-2.5 text-[12.5px]"
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
                <div className="py-10 text-center text-[13px] text-ink-muted">
                  {isLoading ? "Loading documents..." : "No documents uploaded yet."}
                </div>
              )}
            </div>
          </div>
        </div>

        {documents.length > recentActivityLimit ? (
          <p className="nums mt-3 border-t border-paper-line pt-3 text-[12px] text-ink-muted">
            Showing {visibleDocuments.length} of {documents.length} documents.
          </p>
        ) : null}
      </section>
    </section>
  );
}
