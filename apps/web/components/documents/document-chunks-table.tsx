"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CHUNK_PAGE_SIZE, listDocumentChunks, type DocumentChunksPage } from "@/lib/api";
import { cn } from "@/lib/utils";

type DocumentChunksTableProps = {
  documentId: string;
  getAccessToken: () => Promise<string | null>;
};

const WINDOW_EDGE = 1;

/** Numeric page buttons with gaps, so a 200-page document never renders 200 buttons. */
function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const wanted = new Set<number>([
    1,
    total,
    current - WINDOW_EDGE,
    current,
    current + WINDOW_EDGE
  ]);
  const pages = [...wanted].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  const slots: (number | "gap")[] = [];
  pages.forEach((page, index) => {
    if (index > 0 && page - pages[index - 1] > 1) {
      slots.push("gap");
    }
    slots.push(page);
  });
  return slots;
}

export function DocumentChunksTable({ documentId, getAccessToken }: DocumentChunksTableProps) {
  const [page, setPage] = useState(1);
  const [chunks, setChunks] = useState<DocumentChunksPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Sign in to view chunks.");
      }

      setChunks(await listDocumentChunks(accessToken, documentId, page, CHUNK_PAGE_SIZE));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load chunks.");
    } finally {
      setIsLoading(false);
    }
  }, [documentId, getAccessToken, page]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const totalPages = chunks ? Math.max(1, Math.ceil(chunks.total / chunks.page_size)) : 1;
  const rows = chunks?.items ?? [];
  const firstRow = chunks ? (chunks.page - 1) * chunks.page_size : 0;
  const lastRow = chunks ? firstRow + rows.length : 0;

  const gotoPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) {
      return;
    }
    setPage(nextPage);
  };

  return (
    <section className="surface p-5">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Chunks</p>
          <h3 className="mt-1 text-[17px] font-semibold tracking-tight">Chunk lines</h3>
        </div>
        <p className="nums text-[12px] text-ink-muted">
          {chunks
            ? chunks.total === 0
              ? "0 chunks"
              : `${firstRow + 1}\u2013${lastRow} of ${chunks.total}`
            : "Counting chunks..."}
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-paper-line">
              <th className="eyebrow w-14 px-3 py-2 font-semibold">#</th>
              <th className="eyebrow w-16 px-3 py-2 font-semibold">Page</th>
              <th className="eyebrow w-20 px-3 py-2 font-semibold">Chars</th>
              <th className="eyebrow px-3 py-2 font-semibold">Preview</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-3 py-6 text-ink-muted" colSpan={4}>
                  Loading chunks...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td className="px-3 py-6" colSpan={4}>
                  <p className="text-[13px] text-danger">{error}</p>
                  <button className="focus-ring mt-2 text-[12.5px] font-medium hover:underline" onClick={() => void loadPage()}>
                    Retry
                  </button>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-ink-muted" colSpan={4}>
                  No chunks stored for this document yet.
                </td>
              </tr>
            ) : (
              rows.map((chunk, index) => (
                <tr key={chunk.chunk_index} className="border-b border-paper-line/60 align-top last:border-0">
                  <td className="nums px-3 py-2.5 font-mono text-[11.5px] text-ink-faint">{firstRow + index + 1}</td>
                  <td className="nums px-3 py-2.5 text-ink-muted">{chunk.page_number ?? "\u2014"}</td>
                  <td className="nums px-3 py-2.5 text-ink-muted">{chunk.char_count}</td>
                  <td className="max-w-[520px] px-3 py-2.5">
                    <p className="line-clamp-2 leading-5 text-ink">{chunk.preview}</p>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <nav aria-label="Chunk pages" className="mt-4 flex items-center justify-center gap-1.5">
        <button
          aria-label="Previous chunk page"
          className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-control border border-paper-line bg-paper-soft text-ink-muted transition-colors hover:bg-paper-card disabled:cursor-not-allowed disabled:opacity-40"
          disabled={page <= 1 || isLoading}
          onClick={() => gotoPage(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        {pageWindow(page, totalPages).map((slot, index) =>
          slot === "gap" ? (
            <span key={`gap-${index}`} className="px-1 text-[12px] text-ink-faint">
              ...
            </span>
          ) : (
            <button
              aria-current={slot === page ? "page" : undefined}
              key={slot}
              className={cn(
                "focus-ring nums inline-flex h-8 min-w-8 items-center justify-center rounded-control border px-2 text-[12.5px] font-medium transition-colors",
                slot === page
                  ? "border-transparent bg-night text-white"
                  : "border-paper-line bg-paper-soft text-ink-muted hover:bg-paper-card hover:text-ink"
              )}
              disabled={isLoading}
              onClick={() => gotoPage(slot)}
            >
              {slot}
            </button>
          )
        )}
        <button
          aria-label="Next chunk page"
          className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-control border border-paper-line bg-paper-soft text-ink-muted transition-colors hover:bg-paper-card disabled:cursor-not-allowed disabled:opacity-40"
          disabled={page >= totalPages || isLoading}
          onClick={() => gotoPage(page + 1)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </nav>
    </section>
  );
}
