"use client";

import { useCallback, useRef, useState } from "react";
import { Check, Clipboard, CloudUpload, Download, FileCode, FileText, Loader2, X } from "lucide-react";
import { convertPdfToMarkdown, type MarkdownConversion } from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { useServerError } from "@/lib/server-errors";
import type { Dictionary } from "@/locales/en";
import { Button } from "@/components/ui/button";

type ConvertCopy = Dictionary["convert"];
type ConvertNotice = { key: "copied" | "downloaded" } | { key: "ready"; name: string };

const maxUploadBytes = 50 * 1024 * 1024;

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

function hasPdfExtension(filename: string) {
  return filename.toLowerCase().endsWith(".pdf");
}

function validatePdf(file: File) {
  if (!hasPdfExtension(file.name)) {
    return "wrongFormat";
  }

  if (file.size === 0) {
    return "emptyFile";
  }

  if (file.size > maxUploadBytes) {
    return "tooLarge";
  }

  return null;
}

// Returns a locale-independent error key, or the raw server message when we have no key for it.
function conversionErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "failed";
  }

  if (error.message.includes("NEXT_PUBLIC_SUPABASE_")) {
    return "notConfigured";
  }

  return error.message;
}

function convertNoticeText(notice: ConvertNotice, copy: ConvertCopy) {
  if (notice.key === "ready") {
    return copy.notices.ready(notice.name);
  }

  return copy.notices[notice.key];
}

export function MarkdownConverterPanel() {
  const t = useT();
  const copy = t.convert;
  const serverError = useServerError();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [conversion, setConversion] = useState<MarkdownConversion | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ConvertNotice | null>(null);

  const getAccessToken = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const selectFile = (selectedFile: File) => {
    setError(null);
    setNotice(null);
    setConversion(null);

    const validationError = validatePdf(selectedFile);
    if (validationError) {
      setFile(null);
      setError(validationError);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setFile(selectedFile);
  };

  const handleConvert = async () => {
    if (!file) {
      setError("noFile");
      return;
    }

    const validationError = validatePdf(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsConverting(true);
    setError(null);
    setNotice(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("signIn");
        return;
      }

      const converted = await convertPdfToMarkdown(accessToken, file);
      setConversion(converted);
      setNotice({ key: "ready", name: converted.output_filename });
    } catch (convertError) {
      setError(conversionErrorMessage(convertError));
    } finally {
      setIsConverting(false);
    }
  };

  const handleCopy = async () => {
    if (!conversion?.markdown) {
      return;
    }

    try {
      await navigator.clipboard.writeText(conversion.markdown);
      setNotice({ key: "copied" });
    } catch {
      setError("copyFailed");
    }
  };

  const handleDownload = () => {
    if (!conversion?.markdown) {
      return;
    }

    const blob = new Blob([conversion.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = conversion.output_filename || "converted.md";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice({ key: "downloaded" });
  };

  const clearSelection = () => {
    setFile(null);
    setConversion(null);
    setError(null);
    setNotice(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-[26px] font-semibold text-ink">{copy.title}</h2>
          <p className="mt-1 font-secondary text-[13px] text-ink-muted">{copy.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={isConverting} onClick={() => fileInputRef.current?.click()} variant="secondary">
            <FileText className="mr-2 h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            {copy.browsePdf}
          </Button>
          <Button disabled={!file || isConverting} onClick={() => void handleConvert()}>
            {isConverting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={2.2} aria-hidden="true" /> : <FileCode className="mr-2 h-4 w-4" strokeWidth={2.2} aria-hidden="true" />}
            {isConverting ? copy.converting : copy.convert}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div
            className={`flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-card border border-dashed p-8 text-center transition ${
              isDragging ? "border-ink bg-paper-chip" : "border-paper-line bg-paper-card hover:bg-paper-chip"
            }`}
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
              const droppedFile = event.dataTransfer.files?.[0];
              if (droppedFile) {
                selectFile(droppedFile);
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
              accept=".pdf,application/pdf"
              disabled={isConverting}
              onChange={(event) => {
                const selectedFile = event.target.files?.[0];
                if (selectedFile) {
                  selectFile(selectedFile);
                }
              }}
            />
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-card bg-paper-chip text-ink">
              <CloudUpload className="h-7 w-7" strokeWidth={2.2} aria-hidden="true" />
            </div>
            <h3 className="text-[17px] font-semibold text-ink">{copy.dropTitle}</h3>
            <p className="mt-2 max-w-sm text-[13px] text-ink-muted">{copy.dropBody}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <span className="inline-flex h-10 items-center justify-center rounded-card border border-paper-line bg-paper-card px-5 text-[13px] font-semibold text-ink">
                {copy.browsePdf}
              </span>
              <span className="text-[13px] text-ink-muted">{copy.maxLimit}</span>
            </div>
          </div>

          {file ? (
            <div className="rounded-card border border-paper-line bg-paper-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink">{file.name}</p>
                  <p className="mt-1 font-mono text-[11.5px] text-ink-muted">{formatBytes(file.size)}</p>
                </div>
                <button
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-card border border-paper-line text-ink-muted transition hover:border-ink hover:text-ink"
                  onClick={clearSelection}
                  type="button"
                  aria-label={copy.clearPdf}
                >
                  <X className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="space-y-2 text-[13px]">
            {notice ? (
              <p className="flex items-center gap-2 rounded-control border border-success-line bg-success-soft p-3 text-success-ink">
                <Check className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                {convertNoticeText(notice, copy)}
              </p>
            ) : null}
            {error ? (
              <p className="rounded-control border border-danger-line bg-danger-soft p-3 text-danger">
                {copy.errors[error as keyof ConvertCopy["errors"]] ?? serverError(error)}
              </p>
            ) : null}
          </div>
        </div>

        <section className="min-h-[520px] rounded-card border border-paper-line bg-paper-card">
          <div className="flex flex-col gap-3 border-b border-paper-line bg-paper-chip p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-ink">{copy.previewTitle}</h3>
              <p className="mt-1 truncate text-[11.5px] text-ink-muted">
                {conversion
                  ? copy.previewFile(conversion.output_filename, formatBytes(conversion.size_bytes))
                  : copy.previewEmptyMeta}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!conversion?.markdown} onClick={() => void handleCopy()} variant="secondary">
                <Clipboard className="mr-2 h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                {copy.copy}
              </Button>
              <Button disabled={!conversion?.markdown} onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                {copy.download}
              </Button>
            </div>
          </div>
          <pre className="min-h-[440px] overflow-auto whitespace-pre-wrap p-4 font-mono text-[13px] leading-6 text-ink">
            {conversion?.markdown || copy.noMarkdown}
          </pre>
        </section>
      </div>
    </section>
  );
}
