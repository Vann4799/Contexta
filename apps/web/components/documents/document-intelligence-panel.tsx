"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Copy, FileText, Sparkles } from "lucide-react";
import {
  generateDocumentAIBrief,
  getDocument,
  getDocumentIntelligence,
  type DocumentIntelligence,
  type DocumentItem
} from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { DocumentChunksTable } from "@/components/documents/document-chunks-table";

type DocumentIntelligencePanelProps = {
  documentId: string;
};

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

function FieldList({ empty, items }: { empty: string; items: string[] }) {
  if (items.length === 0) {
    return <p className="text-[13px] text-ink-muted">{empty}</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="max-w-full truncate rounded-chip bg-paper-chip px-2 py-1 font-mono text-[11.5px] text-ink">
          {item}
        </span>
      ))}
    </div>
  );
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${part}-${index}`} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <Fragment key={`${part}-${index}`}>{part.replace(/\*/g, "")}</Fragment>;
  });
}

function FormattedBrief({ text }: { text: string }) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="mt-3 space-y-3 text-sm leading-6 text-ink">
      {lines.map((line, index) => {
        const normalizedLine = line.replace(/^\*\s+/, "").trim();
        const headingMatch = normalizedLine.match(/^\*\*(\d+\.\s+[^*]+)\*\*$/);

        if (headingMatch) {
          return (
            <h5 key={`${line}-${index}`} className="pt-2 text-sm font-semibold text-ink">
              {headingMatch[1]}
            </h5>
          );
        }

        if (line.startsWith("*")) {
          return (
            <div key={`${line}-${index}`} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-night" />
              <p>{renderInlineMarkdown(normalizedLine)}</p>
            </div>
          );
        }

        return <p key={`${line}-${index}`}>{renderInlineMarkdown(normalizedLine)}</p>;
      })}
    </div>
  );
}

export function DocumentIntelligencePanel({ documentId }: DocumentIntelligencePanelProps) {
  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [intelligence, setIntelligence] = useState<DocumentIntelligence | null>(null);
  const [aiBrief, setAIBrief] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const getAccessToken = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadDocument() {
      setIsLoading(true);
      setError(null);

      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error("Sign in to view this document.");
        }

        const loadedDocument = await getDocument(accessToken, documentId);
        const loadedIntelligence = loadedDocument.status === "ready" ? await getDocumentIntelligence(accessToken, documentId) : null;

        if (!isMounted) {
          return;
        }

        setDocument(loadedDocument);
        setIntelligence(loadedIntelligence);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load document.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDocument();

    return () => {
      isMounted = false;
    };
  }, [documentId, getAccessToken]);

  useEffect(() => {
    if (!document || (document.status !== "uploaded" && document.status !== "processing")) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          return;
        }

        const refreshedDocument = await getDocument(accessToken, documentId);
        setDocument(refreshedDocument);
        if (refreshedDocument.status === "ready") {
          setIntelligence(await getDocumentIntelligence(accessToken, documentId));
        }
      } catch {
        return;
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [document, documentId, getAccessToken]);

  const handleGenerateBrief = async () => {
    setIsGeneratingBrief(true);
    setBriefError(null);
    setCopyMessage(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Sign in to generate an AI brief.");
      }

      const generated = await generateDocumentAIBrief(accessToken, documentId);
      setAIBrief(generated.brief);
    } catch (generateError) {
      setBriefError(generateError instanceof Error ? generateError.message : "Unable to generate AI brief.");
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  const handleCopyBrief = async () => {
    if (!aiBrief) {
      return;
    }

    try {
      await navigator.clipboard.writeText(aiBrief);
      setCopyMessage("Brief copied.");
    } catch {
      setCopyMessage("Unable to copy brief.");
    }
  };

  if (isLoading) {
    return <section className="surface p-5 text-[13px] text-ink-muted">Loading document intelligence...</section>;
  }

  if (error || !document) {
    return (
      <section className="surface p-5">
        <p className="text-[13px] text-danger">{error || "Document not found."}</p>
        <Link className="mt-4 inline-block text-[13px] font-medium hover:underline" href="/documents">
          Back to documents
        </Link>
      </section>
    );
  }

  const normalizedStatus = document.status === "uploaded" ? "processing" : document.status;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Link
          className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-control px-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-paper-chip hover:text-ink"
          href="/documents"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All documents
        </Link>
        <StatusPill status={normalizedStatus} />
      </div>

      <section className="surface flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-7">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-night shadow-root">
            <FileText className="h-6 w-6 text-accent" strokeWidth={2.2} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Document intelligence</p>
            <h2 className="mt-1 truncate text-[20px] font-semibold leading-tight tracking-tight">{document.filename}</h2>
            <p className="mt-0.5 truncate font-mono text-[12px] text-ink-muted">
              {document.file_type.toUpperCase()} · {formatBytes(document.file_size)} ·{" "}
              {intelligence?.chunk_count ?? document.chunk_count} chunks
            </p>
          </div>
        </div>
      </section>

      {normalizedStatus === "processing" ? (
        <section className="surface border-ink/15 px-5 py-4">
          <h3 className="text-[15px] font-semibold tracking-tight">Indexing in progress</h3>
          <p className="mt-1 text-[13px] leading-6 text-ink-muted">
            Contexta is extracting text and creating searchable chunks. This page refreshes automatically every few seconds.
          </p>
        </section>
      ) : null}

      {document.status === "failed" ? (
        <section className="rounded-card border border-danger-line bg-danger-soft p-5">
          <h3 className="text-[15px] font-semibold tracking-tight text-danger">Processing failed</h3>
          <p className="mt-1 text-[13px] leading-6 text-danger">{document.error_message || "The worker could not process this document."}</p>
          <Link className="mt-3 inline-block text-[13px] font-medium text-danger hover:underline" href="/documents">
            Go back to documents to retry or delete it.
          </Link>
        </section>
      ) : null}

      {document.status === "ready" && !intelligence ? (
        <section className="surface p-5 text-[13px] text-ink-muted">Loading processed document details...</section>
      ) : null}

      {document.status === "ready" && intelligence ? (
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-3">
          <article className="surface p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="eyebrow">Summary</p>
                <h3 className="mt-1 text-[17px] font-semibold tracking-tight">Automatic brief</h3>
              </div>
              <Button disabled={isGeneratingBrief || document.status !== "ready"} onClick={() => void handleGenerateBrief()}>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {isGeneratingBrief ? "Generating..." : "Generate AI brief"}
              </Button>
            </div>
            <p className="mt-3 text-[13.5px] leading-6 text-ink">{intelligence.summary}</p>
            {briefError ? <p className="mt-3 text-[13px] text-danger">{briefError}</p> : null}
            {aiBrief ? (
              <div className="mt-4 rounded-card border border-paper-line bg-paper-soft px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="text-[13.5px] font-semibold">AI brief</h4>
                  <Button className="w-full sm:w-auto" onClick={() => void handleCopyBrief()} variant="secondary">
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Copy brief
                  </Button>
                </div>
                <FormattedBrief text={aiBrief} />
                {copyMessage ? <p className="mt-3 text-[12px] text-ink-muted">{copyMessage}</p> : null}
              </div>
            ) : null}
          </article>

          <article className="surface p-5">
            <p className="eyebrow">Extracted</p>
            <h3 className="mt-1 text-[17px] font-semibold tracking-tight">Key points</h3>
            {intelligence.key_points.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2 text-[13.5px] leading-6">
                {intelligence.key_points.map((point) => (
                  <li key={point} className="rounded-control bg-paper-chip px-3 py-2">
                    {point}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] text-ink-muted">No text has been extracted yet.</p>
            )}
          </article>

          <DocumentChunksTable documentId={document.id} getAccessToken={getAccessToken} />
        </div>

        <aside className="flex min-w-0 flex-col gap-3">
          <article className="surface p-5">
            <p className="eyebrow">Entities</p>
            <h3 className="mt-1 text-[17px] font-semibold tracking-tight">Detected fields</h3>
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <p className="mb-2 text-[12px] font-medium text-ink-muted">Names</p>
                <FieldList empty="No names detected yet." items={intelligence.candidate_names} />
              </div>
              <div>
                <p className="mb-2 text-[12px] font-medium text-ink-muted">Emails</p>
                <FieldList empty="No emails detected yet." items={intelligence.emails} />
              </div>
              <div>
                <p className="mb-2 text-[12px] font-medium text-ink-muted">Links</p>
                <FieldList empty="No links detected yet." items={intelligence.links} />
              </div>
            </div>
          </article>

          <article className="surface p-5">
            <p className="eyebrow">Ask</p>
            <h3 className="mt-1 text-[17px] font-semibold tracking-tight">Suggested questions</h3>
            <div className="mt-3 flex flex-col gap-2">
              {intelligence.suggested_questions.map((question) => (
                <Link
                  key={question}
                  className="focus-ring flex items-start gap-2 rounded-control border border-paper-line bg-paper-soft px-3 py-2 text-[13px] transition-colors hover:bg-paper-card"
                  href={`/chat?question=${encodeURIComponent(question)}&documentId=${encodeURIComponent(document.id)}`}
                >
                  <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
                  <span className="min-w-0">{question}</span>
                </Link>
              ))}
            </div>
          </article>
        </aside>
      </section>
      ) : null}
    </div>
  );
}
