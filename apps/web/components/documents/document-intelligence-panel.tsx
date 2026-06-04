"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  getDocument,
  getDocumentIntelligence,
  type DocumentIntelligence,
  type DocumentItem
} from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { StatusPill } from "@/components/ui/status-pill";

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

export function DocumentIntelligencePanel({ documentId }: DocumentIntelligencePanelProps) {
  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [intelligence, setIntelligence] = useState<DocumentIntelligence | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        const [loadedDocument, loadedIntelligence] = await Promise.all([
          getDocument(accessToken, documentId),
          getDocumentIntelligence(accessToken, documentId)
        ]);

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

  if (isLoading) {
    return <section className="rounded-contexta border border-border bg-white p-5 text-sm text-subtle">Loading document intelligence...</section>;
  }

  if (error || !document || !intelligence) {
    return (
      <section className="rounded-contexta border border-border bg-white p-5">
        <p className="text-sm text-red-700">{error || "Document not found."}</p>
        <Link className="mt-4 inline-block text-sm text-primary hover:underline" href="/documents">
          Back to documents
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link className="text-sm text-primary hover:underline" href="/documents">
          Back to documents
        </Link>
        <StatusPill status={document.status === "uploaded" ? "processing" : document.status} />
      </div>

      <section className="rounded-contexta border border-border bg-white p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate font-heading text-xl font-semibold">{document.filename}</h2>
            <p className="mt-1 text-sm text-subtle">
              {document.file_type.toUpperCase()} - {formatBytes(document.file_size)} - {intelligence.chunk_count} chunks
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <article className="rounded-contexta border border-border bg-white p-5">
            <h3 className="font-heading text-lg font-semibold">Automatic Brief</h3>
            <p className="mt-3 text-sm leading-6 text-ink">{intelligence.summary}</p>
          </article>

          <article className="rounded-contexta border border-border bg-white p-5">
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
          <article className="rounded-contexta border border-border bg-white p-5">
            <h3 className="font-heading text-lg font-semibold">Detected Fields</h3>
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-subtle">Names</p>
                <FieldList empty="No names detected yet." items={intelligence.candidate_names} />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-subtle">Emails</p>
                <FieldList empty="No emails detected yet." items={intelligence.emails} />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-subtle">Links</p>
                <FieldList empty="No links detected yet." items={intelligence.links} />
              </div>
            </div>
          </article>

          <article className="rounded-contexta border border-border bg-white p-5">
            <h3 className="font-heading text-lg font-semibold">Suggested Questions</h3>
            <div className="mt-3 space-y-2">
              {intelligence.suggested_questions.map((question) => (
                <p key={question} className="rounded border border-border bg-muted px-3 py-2 text-sm text-ink">
                  {question}
                </p>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
