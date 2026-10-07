"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import {
  createApiKey,
  getApiKeyUsage,
  listApiKeys,
  listDocuments,
  publicApiBaseUrl,
  revokeApiKey,
  type ApiKey,
  type ApiKeyUsage,
  type CreatedApiKey,
  type DocumentItem
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CHIP_CLASS = {
  active: "bg-success-soft text-success-ink",
  inactive: "bg-danger-soft text-danger",
  neutral: "bg-paper-chip text-ink-muted"
} as const;

type KeyState = "active" | "inactive" | "neutral";

function keyState(key: ApiKey): { state: KeyState; word: string } {
  if (key.revoked_at) {
    return { state: "inactive", word: "Revoked" };
  }
  if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) {
    return { state: "inactive", word: "Expired" };
  }
  return { state: "active", word: "Active" };
}

function formatDate(value: string | null) {
  if (!value) {
    return "never";
  }
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function DeveloperPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [scopeAll, setScopeAll] = useState(true);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [usageByKeyId, setUsageByKeyId] = useState<Record<string, ApiKeyUsage>>({});
  const [isLoadingUsage, setIsLoadingUsage] = useState<string | null>(null);

  const getAccessToken = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const load = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("Sign in to manage API keys.");
        return;
      }
      const [keyRows, documentRows] = await Promise.all([listApiKeys(accessToken), listDocuments(accessToken)]);
      setKeys(keyRows);
      setDocuments(documentRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load API keys.");
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const readyDocuments = useMemo(() => documents.filter((document) => document.status === "ready"), [documents]);

  const handleCreate = async () => {
    if (!name.trim() || (!scopeAll && selectedDocs.length === 0)) {
      setError("Give the key a name, and pick at least one document if it is scoped.");
      return;
    }
    setError(null);
    setIsCreating(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("Sign in to create an API key.");
        return;
      }
      const created = await createApiKey(accessToken, name.trim(), scopeAll ? [] : selectedDocs);
      setCreatedKey(created);
      setIsCopied(false);
      setName("");
      setSelectedDocs([]);
      setScopeAll(true);
      setKeys(await listApiKeys(accessToken));
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create an API key.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!createdKey) {
      return;
    }
    try {
      await navigator.clipboard.writeText(createdKey.api_key);
      setIsCopied(true);
    } catch {
      setError("The browser blocked clipboard access. Select the key and copy it manually.");
    }
  };

  const handleRevoke = async (keyId: string) => {
    setError(null);
    setRevokingId(keyId);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("Sign in to revoke this key.");
        return;
      }
      const revoked = await revokeApiKey(accessToken, keyId);
      setKeys((current) => current.map((item) => (item.id === keyId ? revoked : item)));
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Unable to revoke this key.");
    } finally {
      setRevokingId(null);
    }
  };

  const handleLoadUsage = async (keyId: string) => {
    if (usageByKeyId[keyId]) {
      setUsageByKeyId((current) => {
        const next = { ...current };
        delete next[keyId];
        return next;
      });
      return;
    }
    setError(null);
    setIsLoadingUsage(keyId);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("Sign in to load usage.");
        return;
      }
      const usage = await getApiKeyUsage(accessToken, keyId, 14);
      setUsageByKeyId((current) => ({ ...current, [keyId]: usage }));
    } catch (usageError) {
      setError(usageError instanceof Error ? usageError.message : "Unable to load usage for this key.");
    } finally {
      setIsLoadingUsage(null);
    }
  };

  if (isLoading) {
    return <p className="text-[13px] text-ink-muted">Loading developer settings...</p>;
  }

  return (
    <div className="space-y-3">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Developer</p>
          <h2 className="mt-2 text-[26px] font-semibold text-ink">API keys</h2>
          <p className="mt-2 max-w-2xl text-[13px] text-ink-muted">
            Machine access to retrieval over your indexed documents. Keys are limited to 60 requests a minute and 5.000 a
            day, and every call is logged for 90 days.
          </p>
        </div>
        <Button disabled={isRefreshing} onClick={() => void load()} variant="secondary">
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} aria-hidden="true" />
          Refresh
        </Button>
      </section>

      {error ? (
        <p className="rounded-control border border-danger-line bg-danger-soft px-3 py-2 text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {createdKey ? (
        <section className="rounded-card border border-accent bg-paper-card p-5" aria-live="polite">
          <h3 className="text-[15px] font-semibold text-ink">Copy it now — this is the only time it is shown</h3>
          <p className="mt-1 text-[13px] text-ink-muted">
            Contexta stores only a hash of the key, so a lost one cannot be recovered; revoke it and create a new one.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-control border border-paper-line bg-paper px-3 py-2 font-mono text-[13px] text-ink">
              {createdKey.api_key}
            </code>
            <Button onClick={() => void handleCopy()} variant="primary">
              {isCopied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {isCopied ? "Copied" : "Copy"}
            </Button>
            <Button onClick={() => setCreatedKey(null)} variant="ghost">
              Done
            </Button>
          </div>
        </section>
      ) : null}

      <section className="rounded-card border border-paper-line bg-paper-card p-6">
        <h3 className="text-[17px] font-semibold text-ink">Create a key</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="block">
            <span className="text-[13px] font-semibold text-ink">Name</span>
            <input
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              placeholder="notebook, CI, internal tool..."
              className="mt-2 h-10 w-full rounded-control border border-paper-line bg-paper px-3 text-[13px] text-ink outline-none focus:border-ink"
            />
          </label>
          <Button disabled={isCreating} onClick={() => void handleCreate()} variant="primary">
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            {isCreating ? "Creating..." : "Create key"}
          </Button>
        </div>

        <fieldset className="mt-4 border-0 p-0">
          <legend className="text-[13px] font-semibold text-ink">Documents this key may read</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setScopeAll(true)}
              className={cn(
                "focus-ring rounded-control border px-3 py-1.5 text-[13px] font-semibold transition",
                scopeAll ? "border-ink bg-night text-white" : "border-paper-line bg-paper text-ink-muted hover:border-ink"
              )}
            >
              All documents
            </button>
            <button
              type="button"
              onClick={() => setScopeAll(false)}
              className={cn(
                "focus-ring rounded-control border px-3 py-1.5 text-[13px] font-semibold transition",
                !scopeAll ? "border-ink bg-night text-white" : "border-paper-line bg-paper text-ink-muted hover:border-ink"
              )}
            >
              Selected only
            </button>
          </div>

          {!scopeAll ? (
            <div className="mt-3 max-h-52 overflow-y-auto rounded-control border border-paper-line bg-paper p-3">
              {readyDocuments.length === 0 ? (
                <p className="text-[13px] text-ink-muted">No indexed document to select yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {readyDocuments.map((document) => (
                    <li key={document.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
                        <input
                          checked={selectedDocs.includes(document.id)}
                          type="checkbox"
                          onChange={(event) =>
                            setSelectedDocs((current) =>
                              event.target.checked
                                ? [...current, document.id]
                                : current.filter((id) => id !== document.id)
                            )
                          }
                        />
                        <span className="truncate">{document.filename}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </fieldset>
      </section>

      <section className="rounded-card border border-paper-line bg-paper-card p-6">
        <h3 className="text-[17px] font-semibold text-ink">Existing keys</h3>
        {keys.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-muted">No API key created yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {keys.map((key) => {
              const state = keyState(key);
              const usage = usageByKeyId[key.id];
              return (
                <li key={key.id} className="rounded-card border border-paper-line bg-paper p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold text-ink">{key.name}</span>
                        <span className={cn("chip", CHIP_CLASS[state.state])}>{state.word}</span>
                      </div>
                      <p className="mt-1 font-mono text-[12.5px] text-ink-muted">
                        {key.key_prefix}...{key.last_four}
                      </p>
                      <p className="mt-1 text-[12.5px] text-ink-muted">
                        {key.document_ids.length === 0
                          ? "All documents"
                          : `${key.document_ids.length} document${key.document_ids.length === 1 ? "" : "s"}`}{" "}
                        · created {formatDate(key.created_at)} · last used {formatDate(key.last_used_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        disabled={isLoadingUsage === key.id}
                        onClick={() => void handleLoadUsage(key.id)}
                        variant="ghost"
                        className="h-9 px-3"
                      >
                        {isLoadingUsage === key.id ? "Loading..." : usage ? "Hide usage" : "Usage"}
                      </Button>
                      {key.revoked_at ? null : (
                        <Button
                          disabled={revokingId === key.id}
                          onClick={() => void handleRevoke(key.id)}
                          variant="secondary"
                          className="h-9 px-3"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          {revokingId === key.id ? "Revoking..." : "Revoke"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {usage ? (
                    <div className="mt-3 border-t border-paper-line pt-3">
                      <p className="text-[12.5px] font-semibold text-ink">
                        {usage.total} request{usage.total === 1 ? "" : "s"} in the last {usage.days} days ·{" "}
                        {usage.allowed} allowed · {usage.rejected} rejected
                      </p>
                      <ul className="mt-2 space-y-1">
                        {usage.by_day
                          .filter((day) => day.allowed + day.rejected > 0)
                          .map((day) => (
                            <li key={day.date} className="flex items-center gap-3 text-[12.5px] text-ink-muted">
                              <span className="w-24 shrink-0">{day.date}</span>
                              <span className="text-success-ink">{day.allowed} ok</span>
                              {day.rejected > 0 ? <span className="text-danger">{day.rejected} blocked</span> : null}
                            </li>
                          ))}
                        {usage.by_day.every((day) => day.allowed + day.rejected === 0) ? (
                          <li className="text-[12.5px] text-ink-muted">No requests recorded yet.</li>
                        ) : null}
                      </ul>
                      {Object.keys(usage.by_outcome).some((outcome) => outcome !== "allowed") ? (
                        <p className="mt-2 text-[12.5px] text-ink-muted">
                          Rejected by cause:{" "}
                          {Object.entries(usage.by_outcome)
                            .filter(([outcome]) => outcome !== "allowed")
                            .map(([outcome, count]) => `${outcome} ${count}`)
                            .join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-card border border-paper-line bg-paper-card p-6">
        <h3 className="text-[17px] font-semibold text-ink">Using a key</h3>
        <p className="mt-2 text-[13px] text-ink-muted">
          Retrieval only — no answer generation. Send the key as a bearer token; a browser login token is not accepted
          here. Full endpoint reference lives in <code className="font-mono">docs/api-v1.md</code>.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-control border border-paper-line bg-paper p-4 font-mono text-[12.5px] leading-6 text-ink">
          {`curl -X POST ${publicApiBaseUrl()}/v1/retrieve \\
  -H "Authorization: Bearer ctx_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"query": "refund policy", "top_k": 5}'`}
        </pre>
      </section>
    </div>
  );
}
