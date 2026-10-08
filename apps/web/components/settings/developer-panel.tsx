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
import { useLocale, useT } from "@/lib/i18n";
import { useServerError } from "@/lib/server-errors";
import type { Dictionary } from "@/locales/en";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CHIP_CLASS = {
  active: "bg-success-soft text-success-ink",
  inactive: "bg-danger-soft text-danger",
  neutral: "bg-paper-chip text-ink-muted"
} as const;

type KeyState = "active" | "inactive" | "neutral";
type DeveloperCopy = Dictionary["developer"];
type StateWord = keyof DeveloperCopy["states"];

function keyState(key: ApiKey): { state: KeyState; word: StateWord } {
  if (key.revoked_at) {
    return { state: "inactive", word: "revoked" };
  }
  if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) {
    return { state: "inactive", word: "expired" };
  }
  return { state: "active", word: "active" };
}

function formatDate(value: string | null, locale: string, neverLabel: string) {
  if (!value) {
    return neverLabel;
  }
  return new Date(value).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

function developerErrorKey(error: unknown, fallbackKey: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackKey;
}

export function DeveloperPanel() {
  const t = useT();
  const locale = useLocale();
  const copy = t.developer;
  const serverError = useServerError();
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
        setError("signIn");
        return;
      }
      const [keyRows, documentRows] = await Promise.all([listApiKeys(accessToken), listDocuments(accessToken)]);
      setKeys(keyRows);
      setDocuments(documentRows);
    } catch (loadError) {
      setError(developerErrorKey(loadError, "loadFailed"));
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
      setError("needName");
      return;
    }
    setError(null);
    setIsCreating(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("signInCreate");
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
      setError(developerErrorKey(createError, "createFailed"));
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
      setError("clipboard");
    }
  };

  const handleRevoke = async (keyId: string, keyName: string) => {
    setError(null);

    if (!window.confirm(copy.revokeConfirm(keyName))) {
      return;
    }

    setRevokingId(keyId);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("signInRevoke");
        return;
      }
      const revoked = await revokeApiKey(accessToken, keyId);
      setKeys((current) => current.map((item) => (item.id === keyId ? revoked : item)));
    } catch (revokeError) {
      setError(developerErrorKey(revokeError, "revokeFailed"));
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
        setError("signInUsage");
        return;
      }
      const usage = await getApiKeyUsage(accessToken, keyId, 14);
      setUsageByKeyId((current) => ({ ...current, [keyId]: usage }));
    } catch (usageError) {
      setError(developerErrorKey(usageError, "usageFailed"));
    } finally {
      setIsLoadingUsage(null);
    }
  };

  if (isLoading) {
    return <p className="text-[13px] text-ink-muted">{copy.loading}</p>;
  }

  return (
    <div className="space-y-3">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 className="mt-2 text-[26px] font-semibold text-ink">{copy.title}</h2>
          <p className="mt-2 max-w-2xl text-[13px] text-ink-muted">{copy.description}</p>
        </div>
        <Button disabled={isRefreshing} onClick={() => void load()} variant="secondary">
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} aria-hidden="true" />
          {copy.refresh}
        </Button>
      </section>

      {error ? (
        <p className="rounded-control border border-danger-line bg-danger-soft px-3 py-2 text-[13px] text-danger" role="alert">
          {copy.errors[error as keyof DeveloperCopy["errors"]] ?? serverError(error)}
        </p>
      ) : null}

      {createdKey ? (
        <section className="rounded-card border border-accent bg-paper-card p-5" aria-live="polite">
          <h3 className="text-[15px] font-semibold text-ink">{copy.createdTitle}</h3>
          <p className="mt-1 text-[13px] text-ink-muted">{copy.createdBody}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-control border border-paper-line bg-paper px-3 py-2 font-mono text-[13px] text-ink">
              {createdKey.api_key}
            </code>
            <Button onClick={() => void handleCopy()} variant="primary">
              {isCopied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {isCopied ? copy.copied : copy.copy}
            </Button>
            <Button onClick={() => setCreatedKey(null)} variant="ghost">
              {copy.done}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="rounded-card border border-paper-line bg-paper-card p-6">
        <h3 className="text-[17px] font-semibold text-ink">{copy.createTitle}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="block">
            <span className="text-[13px] font-semibold text-ink">{copy.nameLabel}</span>
            <input
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              placeholder={copy.namePlaceholder}
              className="mt-2 h-10 w-full rounded-control border border-paper-line bg-paper px-3 text-[13px] text-ink outline-none focus:border-ink"
            />
          </label>
          <Button disabled={isCreating} onClick={() => void handleCreate()} variant="primary">
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            {isCreating ? copy.creating : copy.createKey}
          </Button>
        </div>

        <fieldset className="mt-4 border-0 p-0">
          <legend className="text-[13px] font-semibold text-ink">{copy.scopeLegend}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setScopeAll(true)}
              className={cn(
                "focus-ring rounded-control border px-3 py-1.5 text-[13px] font-semibold transition",
                scopeAll ? "border-ink bg-night text-white" : "border-paper-line bg-paper text-ink-muted hover:border-ink"
              )}
            >
              {copy.scopeAll}
            </button>
            <button
              type="button"
              onClick={() => setScopeAll(false)}
              className={cn(
                "focus-ring rounded-control border px-3 py-1.5 text-[13px] font-semibold transition",
                !scopeAll ? "border-ink bg-night text-white" : "border-paper-line bg-paper text-ink-muted hover:border-ink"
              )}
            >
              {copy.scopeSelected}
            </button>
          </div>

          {!scopeAll ? (
            <div className="mt-3 max-h-52 overflow-y-auto rounded-control border border-paper-line bg-paper p-3">
              {readyDocuments.length === 0 ? (
                <p className="text-[13px] text-ink-muted">{copy.noReadyDocuments}</p>
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
        <h3 className="text-[17px] font-semibold text-ink">{copy.existingTitle}</h3>
        {keys.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-muted">{copy.emptyKeys}</p>
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
                        <span className={cn("chip", CHIP_CLASS[state.state])}>{copy.states[state.word]}</span>
                      </div>
                      <p className="mt-1 font-mono text-[12.5px] text-ink-muted">
                        {key.key_prefix}...{key.last_four}
                      </p>
                      <p className="mt-1 text-[12.5px] text-ink-muted">
                        {key.document_ids.length === 0 ? copy.scopeAll : copy.documentCount(key.document_ids.length)}{" "}
                        · {copy.createdOn(formatDate(key.created_at, locale, copy.never))} ·{" "}
                        {copy.lastUsedOn(formatDate(key.last_used_at, locale, copy.never))}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        disabled={isLoadingUsage === key.id}
                        onClick={() => void handleLoadUsage(key.id)}
                        variant="ghost"
                        className="h-9 px-3"
                      >
                        {isLoadingUsage === key.id ? copy.loadingShort : usage ? copy.hideUsage : copy.usage}
                      </Button>
                      {key.revoked_at ? null : (
                        <Button
                          disabled={revokingId === key.id}
                          onClick={() => void handleRevoke(key.id, key.name)}
                          variant="secondary"
                          className="h-9 px-3"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          {revokingId === key.id ? copy.revoking : copy.revoke}
                        </Button>
                      )}
                    </div>
                  </div>

                  {usage ? (
                    <div className="mt-3 border-t border-paper-line pt-3">
                      <p className="text-[12.5px] font-semibold text-ink">
                        {copy.usageSummary(usage.total, usage.days, usage.allowed, usage.rejected)}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {usage.by_day
                          .filter((day) => day.allowed + day.rejected > 0)
                          .map((day) => (
                            <li key={day.date} className="flex items-center gap-3 text-[12.5px] text-ink-muted">
                              <span className="w-24 shrink-0">{day.date}</span>
                              <span className="text-success-ink">{copy.dayAllowed(day.allowed)}</span>
                              {day.rejected > 0 ? (
                                <span className="text-danger">{copy.dayRejected(day.rejected)}</span>
                              ) : null}
                            </li>
                          ))}
                        {usage.by_day.every((day) => day.allowed + day.rejected === 0) ? (
                          <li className="text-[12.5px] text-ink-muted">{copy.noRequests}</li>
                        ) : null}
                      </ul>
                      {Object.keys(usage.by_outcome).some((outcome) => outcome !== "allowed") ? (
                        <p className="mt-2 text-[12.5px] text-ink-muted">
                          {copy.rejectedByCause}{" "}
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
        <h3 className="text-[17px] font-semibold text-ink">{copy.usingTitle}</h3>
        <p className="mt-2 text-[13px] text-ink-muted">
          {copy.usingIntro} <code className="font-mono">docs/api-v1.md</code>. {copy.usingMcp}{" "}
          <code className="font-mono">/mcp</code> {copy.usingMcpTail}
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
