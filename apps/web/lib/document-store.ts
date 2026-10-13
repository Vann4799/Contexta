import { listDocuments, type DocumentItem } from "@/lib/api";

// The dashboard mounts three components that each needed the whole library, so one page
// load paid for the same request three times on a link where a call costs ~400 ms.
// Concurrent callers share one request, and a short TTL keeps mount-time duplicates from
// turning into sequential refetches. Mutations invalidate explicitly.
const CACHE_TTL_MS = 10_000;

let entry: { token: string; readAt: number; documents: DocumentItem[] } | null = null;
let inFlight: Promise<DocumentItem[]> | null = null;

export function invalidateDocuments() {
  entry = null;
}

export function fetchDocuments(accessToken: string, options: { force?: boolean } = {}) {
  const fresh = entry && entry.token === accessToken && Date.now() - entry.readAt < CACHE_TTL_MS;
  if (fresh && !options.force) {
    return Promise.resolve(entry!.documents);
  }
  if (inFlight && !options.force) {
    return inFlight;
  }
  const request = listDocuments(accessToken)
    .then((documents) => {
      entry = { token: accessToken, readAt: Date.now(), documents };
      return documents;
    })
    .finally(() => {
      if (inFlight === request) {
        inFlight = null;
      }
    });
  inFlight = request;
  return request;
}
