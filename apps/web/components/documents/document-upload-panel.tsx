"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CloudUpload, Download, RefreshCw, Upload } from "lucide-react";
import {
  deleteDocument,
  exportWorkspace,
  getIndexingHealth,
  reindexDocument,
  retryDocument,
  uploadDocument,
  updateDocumentMetadata,
  listDocuments,
  type DocumentItem,
  type DocumentStatus,
  type DocumentType,
  type IndexingHealth
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { saveBlobAsFile } from "@/lib/download";
import { useT } from "@/lib/i18n";
import { useServerError } from "@/lib/server-errors";
import type { Dictionary } from "@/locales/en";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";

type UploadCopy = Dictionary["documents"]["upload"];

type UploadNotice =
  | { key: "uploaded" | "deleted" | "retried" | "reindexed" | "exported"; name: string }
  | { key: "classified"; name: string; docType: DocumentType };

const allowedExtensions = new Set(["pdf", "docx"]);
const maxUploadBytes = 50 * 1024 * 1024;

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

// Returns a translation key for our own failures and the raw server text for anything else,
// which callers resolve through t.errors with a fallback to the string itself.
function uploadErrorMessage(error: unknown, fallbackKey: string) {
  if (!(error instanceof Error)) {
    return fallbackKey;
  }

  if (error.message.includes("NEXT_PUBLIC_SUPABASE_")) {
    return "notConfigured";
  }

  return error.message;
}

function indexingHealthLabel(health: IndexingHealth | null, t: UploadCopy) {
  if (!health) {
    return t.health.unknownLabel;
  }

  if (health.status === "attention") {
    return t.health.attentionLabel;
  }

  return t.health.activeLabel;
}

function indexingHealthDetail(health: IndexingHealth | null, t: UploadCopy) {
  if (!health) {
    return t.health.unknownDetail;
  }

  if (health.status === "attention") {
    return t.health.staleDetail(health.stale_processing_documents, health.stale_after_minutes);
  }

  if (health.queued_documents > 0) {
    return t.health.queuedDetail(health.queued_documents);
  }

  if (health.processing_documents > 0) {
    return t.health.processingDetail(health.processing_documents);
  }

  return t.health.noStaleDetail;
}

export function DocumentUploadPanel() {
  const t = useT();
  const copy = t.documents.upload;
  const serverError = useServerError();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mutatingDocumentId, setMutatingDocumentId] = useState<string | null>(null);
  const [indexingHealth, setIndexingHealth] = useState<IndexingHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<UploadNotice | null>(null);
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
        setError("signIn");
        return;
      }

      setDocuments(await listDocuments(accessToken));
    } catch (loadError) {
      setError(uploadErrorMessage(loadError, "loadFailed"));
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
    setNotice(null);

    if (!allowedExtensions.has(getExtension(file.name))) {
      setError("wrongFormat");
      return;
    }

    if (file.size === 0) {
      setError("emptyFile");
      return;
    }

    if (file.size > maxUploadBytes) {
      setError("tooLarge");
      return;
    }

    setIsUploading(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("signIn");
        return;
      }

      const uploadedDocument = await uploadDocument(accessToken, file, docType);
      setDocuments((currentDocuments) => [uploadedDocument, ...currentDocuments]);
      try {
        setIndexingHealth(await getIndexingHealth());
      } catch {
        setIndexingHealth(null);
      }
      setNotice({ key: "uploaded", name: uploadedDocument.filename });
    } catch (uploadError) {
      setError(uploadErrorMessage(uploadError, "uploadFailed"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDocTypeChange = async (document: DocumentItem, nextDocType: DocumentType) => {
    setError(null);
    setNotice(null);
    setMutatingDocumentId(document.id);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("signIn");
        return;
      }

      const updatedDocument = await updateDocumentMetadata(accessToken, document.id, {
        doc_type: nextDocType
      });
      setDocuments((currentDocuments) =>
        currentDocuments.map((item) => (item.id === updatedDocument.id ? updatedDocument : item))
      );
      setNotice({ key: "classified", name: updatedDocument.filename, docType: updatedDocument.doc_type });
    } catch (updateError) {
      setError(uploadErrorMessage(updateError, "typeFailed"));
    } finally {
      setMutatingDocumentId(null);
    }
  };

  const handleDelete = async (document: DocumentItem) => {
    setError(null);
    setNotice(null);

    if (!window.confirm(copy.deleteConfirm(document.filename))) {
      return;
    }

    setMutatingDocumentId(document.id);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("signInDelete");
        return;
      }

      await deleteDocument(accessToken, document.id);
      setDocuments((currentDocuments) => currentDocuments.filter((currentDocument) => currentDocument.id !== document.id));
      setNotice({ key: "deleted", name: document.filename });
    } catch (deleteError) {
      setError(uploadErrorMessage(deleteError, "deleteFailed"));
    } finally {
      setMutatingDocumentId(null);
    }
  };

  const handleRetry = async (document: DocumentItem) => {
    setError(null);
    setNotice(null);
    setMutatingDocumentId(document.id);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("signInRetry");
        return;
      }

      const retriedDocument = await retryDocument(accessToken, document.id);
      setDocuments((currentDocuments) => currentDocuments.map((currentDocument) => (currentDocument.id === document.id ? retriedDocument : currentDocument)));
      setNotice({ key: "retried", name: document.filename });
    } catch (retryError) {
      setError(uploadErrorMessage(retryError, "retryFailed"));
    } finally {
      setMutatingDocumentId(null);
    }
  };

  const handleReindex = async (document: DocumentItem) => {
    setError(null);
    setNotice(null);
    setMutatingDocumentId(document.id);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("signInReindex");
        return;
      }

      const reindexedDocument = await reindexDocument(accessToken, document.id);
      setDocuments((currentDocuments) => currentDocuments.map((currentDocument) => (currentDocument.id === document.id ? reindexedDocument : currentDocument)));
      setNotice({ key: "reindexed", name: document.filename });
    } catch (reindexError) {
      setError(uploadErrorMessage(reindexError, "reindexFailed"));
    } finally {
      setMutatingDocumentId(null);
    }
  };

  const handleExportWorkspace = async () => {
    setError(null);
    setNotice(null);
    setIsExporting(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("signInExport");
        return;
      }

      const file = await exportWorkspace(accessToken);
      saveBlobAsFile(file.blob, file.filename);
      setNotice({ key: "exported", name: file.filename });
    } catch (exportError) {
      setError(uploadErrorMessage(exportError, "exportFailed"));
    } finally {
      setIsExporting(false);
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
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight">{copy.title}</h2>
          <p className="mt-1 font-secondary text-[13px] text-ink-muted">{copy.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-end gap-2">
          <label className="grid gap-1.5 text-[12px] font-semibold text-ink-muted">
            {copy.docTypeLabel}
            <select
              aria-label={copy.docTypeLabel}
              className="focus-ring h-9 rounded-control border border-paper-line bg-paper-soft px-3 text-[13px] font-normal text-ink outline-none"
              disabled={isUploading}
              onChange={(event) => setDocType(event.target.value as DocumentType)}
              value={docType}
            >
              {(Object.keys(t.common.docTypes) as DocumentType[]).map((value) => (
                <option key={value} value={value}>
                  {t.common.docTypes[value]}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={isLoading || isUploading} onClick={() => void loadDocuments()} variant="secondary">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {copy.refresh}
          </Button>
          <Button disabled={isLoading || isUploading || isExporting} onClick={() => void handleExportWorkspace()} variant="secondary">
            <Download className="h-4 w-4" aria-hidden="true" />
            {isExporting ? copy.exporting : copy.exportWorkspace}
          </Button>
          <Button disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            {isUploading ? copy.uploading : copy.browse}
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
          <h3 className="text-[19px] font-semibold tracking-tight">{copy.dropTitle}</h3>
          <p className="mt-2 max-w-md text-[13px] text-ink-muted">{copy.dropBody}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <span className="inline-flex h-10 items-center justify-center rounded-control bg-accent px-5 text-[13.5px] font-medium text-ink shadow-node">
              {copy.browse}
            </span>
            <span className="chip">{copy.formatHint}</span>
          </div>
        </div>

        <aside className="surface flex p-5 lg:col-span-4">
          <div className="flex w-full flex-col gap-2.5">
            <p className="eyebrow">{copy.statusEyebrow}</p>
            <div className="flex items-center justify-between rounded-control bg-paper-chip px-3 py-2 text-[13px]">
              <span className="text-ink-muted">{copy.storageUsed}</span>
              <span className="nums font-semibold">{formatBytes(totalStorage)}</span>
            </div>
            <div className="flex items-center justify-between rounded-control bg-paper-chip px-3 py-2 text-[13px]">
              <span className="text-ink-muted">{copy.indexingQueue}</span>
              <span className="nums font-semibold">{copy.fileCount(indexingHealth?.queued_documents ?? queueCount)}</span>
            </div>
            <div
              className={cn(
                "rounded-control px-3 py-2 text-[13px]",
                indexingHealth?.status === "attention" ? "bg-warning-soft text-warning" : "bg-success-soft text-success-ink"
              )}
            >
              <p className="font-semibold">{indexingHealthLabel(indexingHealth, copy)}</p>
              <p className="mt-0.5 text-[11.5px]">{indexingHealthDetail(indexingHealth, copy)}</p>
            </div>
            <div className="flex items-center justify-between rounded-control bg-paper-chip px-3 py-2 text-[13px]">
              <span className="text-ink-muted">{copy.readyCount}</span>
              <span className="nums font-semibold">{copy.fileCount(readyCount)}</span>
            </div>
            <p className="mt-auto rounded-control border border-paper-line px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
              {copy.indexingNote}
            </p>
          </div>
        </aside>
      </div>

      <div className="flex flex-col gap-2 text-[13px]">
        {isLoading ? <p className="chip w-fit">{copy.loading}</p> : null}
        {isUploading ? <p className="chip w-fit">{copy.uploadingOne}</p> : null}
        {notice ? (
          <p className="rounded-control bg-success-soft px-3 py-2 text-success-ink" role="status">
            {notice.key === "classified"
              ? copy.messages.classified(notice.name, t.common.docTypes[notice.docType])
              : copy.messages[notice.key](notice.name)}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-control bg-danger-soft px-3 py-2 text-danger" role="alert">
            {copy.errors[error as keyof typeof copy.errors] ?? serverError(error)}
          </p>
        ) : null}
      </div>

      <section className="surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{copy.activityEyebrow}</p>
            <h3 className="mt-1 text-[17px] font-semibold tracking-tight">{copy.recentTitle}</h3>
          </div>
          {documents.length > recentActivityLimit ? (
            <Button disabled={isLoading} onClick={() => setShowAllDocuments((current) => !current)} variant="ghost">
              {showAllDocuments ? copy.showRecent : copy.viewAll}
            </Button>
          ) : null}
        </div>

        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-12 gap-3 border-b border-paper-line pb-2">
              <div className="eyebrow col-span-4">{copy.colFile}</div>
              <div className="eyebrow col-span-1">{copy.colSize}</div>
              <div className="eyebrow col-span-2">{copy.colType}</div>
              <div className="eyebrow col-span-2">{copy.colStatus}</div>
              <div className="eyebrow col-span-3 text-right">{copy.colActions}</div>
            </div>
            <div>
              {visibleDocuments.length > 0 ? (
                visibleDocuments.map((document) => (
                  <div
                    key={document.id}
                    className="grid grid-cols-12 items-center gap-3 border-b border-paper-line/60 py-3 last:border-0"
                  >
                    <div className="col-span-4 flex min-w-0 items-center gap-3">
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
                          <p className="truncate text-[11.5px] text-danger" title={serverError(document.error_message)}>
                            {serverError(document.error_message)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="nums col-span-1 text-[12.5px] text-ink-muted">{formatBytes(document.file_size)}</div>
                    <div className="col-span-2">
                      <select
                        aria-label={copy.docTypeFor(document.filename)}
                        className="focus-ring h-8 w-full max-w-[190px] rounded-control border border-paper-line bg-paper-soft px-2 text-[12.5px] outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={
                          mutatingDocumentId === document.id ||
                          document.status === "uploaded" ||
                          document.status === "processing"
                        }
                        onChange={(event) =>
                          void handleDocTypeChange(document, event.target.value as DocumentType)
                        }
                        value={document.doc_type}
                      >
                        {(Object.keys(t.common.docTypes) as DocumentType[]).map((value) => (
                          <option key={value} value={value}>
                            {t.common.docTypes[value]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <StatusPill status={statusForPill(document.status)} />
                    </div>
                    <div className="col-span-3 flex justify-end gap-1">
                      {document.status === "failed" ? (
                        <Button
                          className="h-8 px-2.5 text-[12.5px]"
                          disabled={mutatingDocumentId === document.id}
                          onClick={() => void handleRetry(document)}
                          variant="secondary"
                        >
                          {copy.retry}
                        </Button>
                      ) : null}
                      {document.status === "ready" ? (
                        <Button
                          className="h-8 px-2.5 text-[12.5px]"
                          disabled={mutatingDocumentId === document.id}
                          onClick={() => void handleReindex(document)}
                          variant="ghost"
                        >
                          {copy.reindex}
                        </Button>
                      ) : null}
                      <Button
                        className="h-8 px-2.5 text-[12.5px]"
                        disabled={mutatingDocumentId === document.id}
                        onClick={() => void handleDelete(document)}
                        variant="ghost"
                      >
                        {copy.delete}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-[13px] text-ink-muted">
                  {isLoading ? copy.loading : copy.emptyList}
                </div>
              )}
            </div>
          </div>
        </div>

        {documents.length > recentActivityLimit ? (
          <p className="nums mt-3 border-t border-paper-line pt-3 text-[12px] text-ink-muted">
            {copy.showing(visibleDocuments.length, documents.length)}
          </p>
        ) : null}
      </section>
    </section>
  );
}
