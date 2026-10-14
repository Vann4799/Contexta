import { listDocuments, type DocumentItem } from "@/lib/api";
import { discardBootData, takeBootData } from "@/lib/boot-prefetch";

// The dashboard mounts three components that each needed the whole library, so one page
// load paid for the same request three times on a link where a call costs ~400 ms.
// Concurrent callers share one request, and a short TTL keeps mount-time duplicates from
// turning into sequential refetches. Mutations invalidate explicitly.
const CACHE_TTL_MS = 10_000;

let entry: { token: string; readAt: number; documents: DocumentItem[] } | null = null;
let inFlight: Promise<DocumentItem[]> | null = null;

export function invalidateDocuments() {
  entry = null;
  // A response still parked from the pre-hydration fetch predates this mutation, so it is
  // dropped here too; otherwise the next mount would adopt the copy it was fetched before.
  discardBootData("documents");
}

/** Register a request so every caller shares it and a resolved one lands in the cache. */
function track(request: Promise<DocumentItem[]>, accessToken: string) {
  const tracked: Promise<DocumentItem[]> = request
    .then((documents) => {
      entry = { token: accessToken, readAt: Date.now(), documents };
      return documents;
    })
    .finally(() => {
      if (inFlight === tracked) {
        inFlight = null;
      }
    });
  inFlight = tracked;
  return tracked;
}

export function fetchDocuments(accessToken: string, options: { force?: boolean } = {}) {
  const fresh = entry && entry.token === accessToken && Date.now() - entry.readAt < CACHE_TTL_MS;
  if (fresh && !options.force) {
    return Promise.resolve(entry!.documents);
  }
  if (inFlight && !options.force) {
    return inFlight;
  }
  const prefetched = options.force ? null : takeBootData<DocumentItem[]>("documents", accessToken);
  // The pre-hydration fetch runs with a token that may have been refreshed or rejected since;
  // a failure there must degrade to today's request rather than become the user's error.
  const request = prefetched ? prefetched.catch(() => listDocuments(accessToken)) : listDocuments(accessToken);
  return track(request, accessToken);
}
