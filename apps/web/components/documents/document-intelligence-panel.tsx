"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
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
    return <p className="text-sm text-subtle">{empty}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="max-w-full truncate rounded border border-border bg-muted px-2 py-1 text-xs text-ink">
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
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
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
    return <section className="rounded-contexta border border-border bg-surface p-5 text-sm text-subtle">Loading document intelligence...</section>;
  }

  if (error || !document) {
    return (
      <section className="rounded-contexta border border-border bg-surface p-5">
        <p className="text-sm text-red-700">{error || "Document not found."}</p>
        <Link className="mt-4 inline-block text-sm text-primary hover:underline" href="/documents">
          Back to documents
        </Link>
      </section>
    );
  }

  const normalizedStatus = document.status === "uploaded" ? "processing" : document.status;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link className="text-sm text-primary hover:underline" href="/documents">
          Back to documents
        </Link>
        <StatusPill status={normalizedStatus} />
      </div>

      <section className="rounded-contexta border border-border bg-surface p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate font-heading text-xl font-semibold">{document.filename}</h2>
            <p className="mt-1 text-sm text-subtle">
              {document.file_type.toUpperCase()} - {formatBytes(document.file_size)} - {(intelligence?.chunk_count ?? document.chunk_count)} chunks
            </p>
          </div>
        </div>
      </section>

      {normalizedStatus === "processing" ? (
        <section className="rounded-contexta border border-accent-soft bg-accent-soft p-5">
          <h3 className="font-heading text-lg font-semibold text-accent">Indexing in progress</h3>
          <p className="mt-2 text-sm leading-6 text-accent">
            Contexta is extracting text and creating searchable chunks. This page refreshes automatically every few seconds.
          </p>
        </section>
      ) : null}

      {document.status === "failed" ? (
        <section className="rounded-contexta border border-red-200 bg-red-50 p-5">
          <h3 className="font-heading text-lg font-semibold text-red-800">Processing failed</h3>
          <p className="mt-2 text-sm leading-6 text-red-800">{document.error_message || "The worker could not process this document."}</p>
          <Link className="mt-4 inline-block text-sm font-medium text-red-800 hover:underline" href="/documents">
            Go back to Documents to retry or delete it.
          </Link>
        </section>
      ) : null}

      {document.status === "ready" && !intelligence ? (
        <section className="rounded-contexta border border-border bg-surface p-5 text-sm text-subtle">Loading processed document details...</section>
      ) : null}

      {document.status === "ready" && intelligence ? (
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <article className="rounded-contexta border border-border bg-surface p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-heading text-lg font-semibold">Automatic Brief</h3>
              <Button disabled={isGeneratingBrief || document.status !== "ready"} onClick={() => void handleGenerateBrief()}>
                {isGeneratingBrief ? "Generating..." : "Generate AI Brief"}
              </Button>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink">{intelligence.summary}</p>
            {briefError ? <p className="mt-3 text-sm text-red-700">{briefError}</p> : null}
            {aiBrief ? (
              <div className="mt-4 rounded border border-border bg-muted px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="text-sm font-semibold text-ink">AI Brief</h4>
                  <Button className="w-full sm:w-auto" onClick={() => void handleCopyBrief()}>
                    Copy Brief
                  </Button>
                </div>
                <FormattedBrief text={aiBrief} />
                {copyMessage ? <p className="mt-3 text-xs text-subtle">{copyMessage}</p> : null}
              </div>
            ) : null}
          </article>

          <article className="rounded-contexta border border-border bg-surface p-5">
            <h3 className="font-heading text-lg font-semibold">Key Points</h3>
            {intelligence.key_points.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm leading-6 text-ink">
                {intelligence.key_points.map((point) => (
                  <li key={point} className="rounded border border-border bg-muted px-3 py-2">
                    {point}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-subtle">No text has been extracted yet.</p>
            )}
          </article>
        </div>

        <aside className="space-y-4">
          <article className="rounded-contexta border border-border bg-surface p-5">
            <h3 className="font-heading text-lg font-semibold">Detected Fields</h3>
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-subtle">Names</p>
                <FieldList empty="No names detected yet." items={intelligence.candidate_names} />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-subtle">Emails</p>
                <FieldList empty="No emails detected yet." items={intelligence.emails} />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-subtle">Links</p>
                <FieldList empty="No links detected yet." items={intelligence.links} />
              </div>
            </div>
          </article>

          <article className="rounded-contexta border border-border bg-surface p-5">
            <h3 className="font-heading text-lg font-semibold">Suggested Questions</h3>
            <div className="mt-3 space-y-2">
              {intelligence.suggested_questions.map((question) => (
                <Link
                  key={question}
                  className="block rounded border border-border bg-muted px-3 py-2 text-sm text-ink hover:border-primary hover:bg-accent-soft"
                  href={`/chat?question=${encodeURIComponent(question)}&documentId=${encodeURIComponent(document.id)}`}
                >
                  {question}
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
