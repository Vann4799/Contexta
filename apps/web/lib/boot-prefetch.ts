/**
 * Typed access to the requests the pre-hydration script in the root layout parked on window.
 *
 * The dashboard's data calls cannot move to a server component: the bearer token only exists in
 * the browser's localStorage, so the earliest point a request can start is document-parse time.
 * That script fires them there and hands the promises over here, where the data layer adopts them
 * instead of starting its own copy.
 */

export type BootRecord = { token: string; requests: Record<string, Promise<unknown>> };

declare global {
  interface Window {
    __CTXA_BOOT__?: BootRecord;
  }
}

function boot(): BootRecord | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.__CTXA_BOOT__ ?? null;
}

/**
 * The parked response for `name`, or null when there is nothing to adopt.
 *
 * A slot is consumed on read: the caller that takes it owns the only copy, so a second mount
 * after an invalidation always goes to the network instead of replaying stale data. The token
 * comparison is what keeps a refreshed session from being served the pre-refresh response.
 */
export function takeBootData<T>(name: string, accessToken: string): Promise<T> | null {
  const record = boot();
  if (!record || record.token !== accessToken) {
    return null;
  }
  const parked = record.requests[name];
  if (!parked) {
    return null;
  }
  delete record.requests[name];
  return parked as Promise<T>;
}

/** Drop a parked response that a mutation has just made obsolete. */
export function discardBootData(name: string) {
  const record = boot();
  if (record) {
    delete record.requests[name];
  }
}
