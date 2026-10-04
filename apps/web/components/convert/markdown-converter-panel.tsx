"use client";

import { useCallback, useRef, useState } from "react";
import { Check, Clipboard, CloudUpload, Download, FileCode, FileText, Loader2, X } from "lucide-react";
import { convertPdfToMarkdown, type MarkdownConversion } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

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
    return "Choose a PDF file with a .pdf extension.";
  }

  if (file.size === 0) {
    return "The selected PDF is empty.";
  }

  if (file.size > maxUploadBytes) {
    return "PDF files must be 50 MB or smaller.";
  }

  return null;
}

function conversionErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Unable to convert PDF to Markdown.";
  }

  if (error.message.includes("NEXT_PUBLIC_SUPABASE_")) {
    return "Authentication is not configured yet. Please contact an administrator.";
  }

  return error.message;
}

export function MarkdownConverterPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [conversion, setConversion] = useState<MarkdownConversion | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const getAccessToken = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
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
      setError("Choose a PDF before converting.");
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
        throw new Error("Sign in to convert PDFs.");
      }

      const converted = await convertPdfToMarkdown(accessToken, file);
      setConversion(converted);
      setNotice(`${converted.output_filename} is ready.`);
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
      setNotice("Markdown copied.");
    } catch {
      setError("Unable to copy Markdown to the clipboard.");
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
    setNotice("Markdown download started.");
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
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="title-rule font-heading text-3xl font-semibold text-ink">PDF to Markdown</h2>
          <p className="mt-1 text-sm text-subtle">Convert a PDF into clean Markdown without adding it to your document library.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={isConverting} onClick={() => fileInputRef.current?.click()} variant="secondary">
            <FileText className="mr-2 h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            Browse PDF
          </Button>
          <Button disabled={!file || isConverting} onClick={() => void handleConvert()}>
            {isConverting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={2.2} aria-hidden="true" /> : <FileCode className="mr-2 h-4 w-4" strokeWidth={2.2} aria-hidden="true" />}
            {isConverting ? "Converting..." : "Convert"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div
            className={`flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded border border-dashed p-8 text-center transition ${
              isDragging ? "border-primary bg-muted" : "border-border bg-surface hover:bg-muted"
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
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-contexta bg-accent-soft text-primary">
              <CloudUpload className="h-7 w-7" strokeWidth={2.2} aria-hidden="true" />
            </div>
            <h3 className="font-heading text-xl font-semibold text-ink">Drag and drop a PDF</h3>
            <p className="mt-2 max-w-sm text-sm text-subtle">The converter accepts one PDF at a time and returns Markdown for preview, copy, or download.</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <span className="inline-flex h-10 items-center justify-center rounded border border-border bg-surface px-5 text-sm font-semibold text-ink">
                Browse PDF
              </span>
              <span className="text-sm text-subtle">Max 50 MB</span>
            </div>
          </div>

          {file ? (
            <div className="rounded border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
                  <p className="mt-1 font-mono text-xs text-subtle">{formatBytes(file.size)}</p>
                </div>
                <button
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border text-subtle transition hover:border-primary hover:text-primary"
                  onClick={clearSelection}
                  type="button"
                  aria-label="Clear selected PDF"
                >
                  <X className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="space-y-2 text-sm">
            {notice ? (
              <p className="flex items-center gap-2 rounded border border-success-line bg-success-soft p-3 text-success">
                <Check className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                {notice}
              </p>
            ) : null}
            {error ? <p className="rounded border border-danger-line bg-danger-soft p-3 text-danger">{error}</p> : null}
          </div>
        </div>

        <section className="min-h-[520px] rounded border border-border bg-surface">
          <div className="flex flex-col gap-3 border-b border-border bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="font-heading text-lg font-semibold text-ink">Markdown Preview</h3>
              <p className="mt-1 truncate text-xs text-subtle">
                {conversion ? `${conversion.output_filename} - ${formatBytes(conversion.size_bytes)}` : "Converted Markdown will appear here."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!conversion?.markdown} onClick={() => void handleCopy()} variant="secondary">
                <Clipboard className="mr-2 h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                Copy
              </Button>
              <Button disabled={!conversion?.markdown} onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                Download
              </Button>
            </div>
          </div>
          <pre className="min-h-[440px] overflow-auto whitespace-pre-wrap p-4 font-mono text-sm leading-6 text-ink">
            {conversion?.markdown || "No Markdown generated yet."}
          </pre>
        </section>
      </div>
    </section>
  );
}
