"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { BillingStatus } from "@/lib/api";
import { getBillingStatus } from "@/lib/api";

type Listener = () => void;

let cached: BillingStatus | null = null;
let inflight: Promise<BillingStatus> | null = null;
const listeners = new Set<Listener>();

function emitChange() {
  for (const fn of listeners) fn();
}

async function fetchOnce(token: string): Promise<BillingStatus> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = getBillingStatus(token).then(
    (status) => {
      cached = status;
      inflight = null;
      emitChange();
      return status;
    },
    (err) => {
      inflight = null;
      throw err;
    },
  );
  return inflight;
}

export function invalidatePlanCache() {
  cached = null;
  inflight = null;
  emitChange();
}

export type PlanGate = {
  billing: BillingStatus | null;
  loading: boolean;
  canUpload: boolean;
  canCreateApiKey: boolean;
  canChat: boolean;
  documentsRemaining: number;
  apiKeysRemaining: number;
  chatRemaining: number;
};

export function usePlanGate(): PlanGate {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const billing = useSyncExternalStore(
    (cb: Listener) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => cached,
    () => null,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token ?? null;
      if (cancelled) return;
      setToken(accessToken);
      if (accessToken) {
        try {
          await fetchOnce(accessToken);
        } catch {
          // billing fetch failure is non-fatal; gates stay open
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!billing || loading) {
    return {
      billing: null,
      loading,
      canUpload: true,
      canCreateApiKey: true,
      canChat: true,
      documentsRemaining: Infinity,
      apiKeysRemaining: Infinity,
      chatRemaining: Infinity,
    };
  }

  const { limits } = billing.plan;
  const { usage } = billing;

  const documentsRemaining = Math.max(0, limits.max_documents - usage.documents_count);
  const apiKeysRemaining = Math.max(0, limits.max_api_keys - usage.api_keys_count);
  const chatRemaining = Math.max(0, limits.max_chat_messages_per_day - usage.chat_messages_today);

  return {
    billing,
    loading: false,
    canUpload: documentsRemaining > 0 && !billing.overages.documents,
    canCreateApiKey: apiKeysRemaining > 0 && !billing.overages.api_keys,
    canChat: chatRemaining > 0 && !billing.overages.chat_messages,
    documentsRemaining,
    apiKeysRemaining,
    chatRemaining,
  };
}
