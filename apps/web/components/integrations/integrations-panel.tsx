"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Link2,
  MessageSquare,
  RefreshCw,
  Unlink,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type {
  IntegrationConnection,
  IntegrationDefinition,
  IntegrationProvider,
} from "@/lib/api";
import {
  disconnectIntegration,
  getIntegrationAuthUrl,
  getIntegrations,
} from "@/lib/api";
import { useT } from "@/lib/i18n";

function ProviderIcon({ provider }: { provider: string }) {
  switch (provider) {
    case "slack":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
        </svg>
      );
    case "github":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      );
    case "notion":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28.047-.653V1.039c0-.373-.28-.653-.653-.606L6.277 1.5c-.7.046-1.307.326-1.82.746L.33 5.692c-.42.373-.373.84.047 1.12l4.082 2.846zm1.447 14.185c0 .42.327.7.747.42l1.633-1.167c.373-.28.467-.7.14-1.026l-.7-.84-2.1-1.447v4.06zm14.328-15.094l-12.602.84c-.56.046-.7.28-.7.7v12.834c0 .42.28.56.653.326l2.614-1.82c.326-.28.28-.7 0-1.073l-3.268-3.827c-.326-.373-.14-.7.28-.7h11.948c.42 0 .7-.28.7-.7V4.019c0-.373-.28-.7-.7-.7zm-7.513 11.667c0 .28-.233.513-.56.513H9.607c-.326 0-.42-.233-.186-.513l2.38-2.847c.233-.28.42-.047.42.233v2.614zm4.294-3.5c0 .28-.233.513-.513.513h-5.181c-.28 0-.42-.233-.233-.513l2.1-2.8c.233-.28.466-.233.466.047v2.753z"/>
        </svg>
      );
    case "google_drive":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5">
          <path fill="#4285F4" d="M12 10.2l-4.2-7.3c-.4-.7-1.3-.9-2-.5-.3.2-.5.4-.7.7L1.3 14.4c-.4.7-.2 1.6.5 2 .3.2.7.3 1 .3h8.4l-3.2-5.5z"/>
          <path fill="#34A853" d="M19.7 14.4l-3.8-6.6c-.4-.7-1.3-.9-2-.5-.3.2-.5.4-.7.7L9 15.3l3.2 5.5c.4.7 1.3.9 2 .5.3-.2.5-.4.7-.7l4.2-7.3c.2-.4.3-.8.2-1.2-.1-.4-.3-.8-.6-1.1z"/>
          <path fill="#FBBC04" d="M12 10.2L7.8 2.9c-.4-.7-1.3-.9-2-.5-.3.2-.5.4-.7.7L1.3 14.4c-.4.7-.2 1.6.5 2 .3.2.7.3 1 .3h16.4c.8 0 1.5-.5 1.7-1.3.1-.4 0-.9-.2-1.2L12 10.2z"/>
        </svg>
      );
    default:
      return <Link2 className="h-5 w-5" strokeWidth={2} />;
  }
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function IntegrationCard({
  definition,
  connection,
  onConnect,
  onDisconnect,
  busy,
}: {
  definition: IntegrationDefinition;
  connection: IntegrationConnection | undefined;
  onConnect: () => void;
  onDisconnect: () => void;
  busy: boolean;
}) {
  const t = useT();
  const isConnected = connection?.status === "connected";
  const isError = connection?.status === "error";

  return (
    <div className="surface flex flex-col rounded-2xl border border-ink-border p-5">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`grid h-10 w-10 place-items-center rounded-xl ${
              isConnected
                ? "bg-amber-100 text-amber-700"
                : "bg-ink-muted/10 text-ink-muted"
            }`}
          >
            <ProviderIcon provider={definition.provider} />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-ink">{definition.name}</p>
            {isConnected ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                {t.integrations.connected}
              </span>
            ) : isError ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
                <AlertCircle className="h-3 w-3" strokeWidth={2} />
                {t.integrations.error}
              </span>
            ) : (
              <span className="text-[11px] text-ink-muted">{t.integrations.disconnected}</span>
            )}
          </div>
        </div>
      </div>

      <p className="mb-4 flex-1 text-[12px] leading-relaxed text-ink-muted">
        {definition.description}
      </p>

      {isConnected && connection ? (
        <div className="mb-4 space-y-1.5 rounded-control border border-ink-border p-3">
          {connection.external_user_name ? (
            <p className="text-[12px] text-ink">
              {t.integrations.connectedAs(connection.external_user_name)}
            </p>
          ) : null}
          {connection.last_synced_at ? (
            <p className="text-[11px] text-ink-muted">
              {t.integrations.lastSynced(formatRelativeTime(connection.last_synced_at))}
            </p>
          ) : null}
          {connection.error_message ? (
            <p className="text-[11px] text-red-600">{connection.error_message}</p>
          ) : null}
          <div className="flex flex-wrap gap-1 pt-1">
            {connection.scopes.map((scope) => (
              <span
                key={scope}
                className="rounded-full bg-ink-muted/10 px-1.5 py-0.5 text-[10px] text-ink-muted"
              >
                {scope}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {isConnected ? (
        <button
          type="button"
          onClick={onDisconnect}
          disabled={busy}
          className="focus-ring flex w-full items-center justify-center gap-2 rounded-control border border-ink-border px-3 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-paper-soft hover:text-ink disabled:opacity-50"
        >
          <Unlink className="h-3.5 w-3.5" strokeWidth={2} />
          {busy ? t.integrations.disconnecting : t.integrations.disconnect}
        </button>
      ) : (
        <button
          type="button"
          onClick={onConnect}
          disabled={busy}
          className="focus-ring flex w-full items-center justify-center gap-2 rounded-control bg-accent px-3 py-2 text-[13px] font-medium text-night transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
          {busy ? t.integrations.connecting : t.integrations.connect}
        </button>
      )}
    </div>
  );
}

export function IntegrationsPanel() {
  const t = useT();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [definitions, setDefinitions] = useState<IntegrationDefinition[]>([]);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<IntegrationProvider | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const getAccessToken = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError(t.integrations.errors.signIn);
        return;
      }
      const result = await getIntegrations(token);
      setDefinitions(result.definitions);
      setConnections(result.connections);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.integrations.errors.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, t.integrations.errors.signIn, t.integrations.errors.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const success = searchParams.get("success");
    const oauthError = searchParams.get("error");
    if (success === "true") {
      setNotice({ type: "success", message: t.integrations.connectedSuccess });
      void load();
    } else if (oauthError) {
      setNotice({ type: "error", message: t.integrations.connectedError });
    }
    const clean = new URLSearchParams(searchParams.toString());
    clean.delete("success");
    clean.delete("error");
    const qs = clean.toString();
    router.replace(qs ? `/integrations?${qs}` : "/integrations");
  }, [searchParams, router, load, t.integrations.connectedSuccess, t.integrations.connectedError]);

  const getConnectionFor = (provider: IntegrationProvider) =>
    connections.find((c) => c.provider === provider);

  const handleConnect = async (provider: IntegrationProvider) => {
    setBusyProvider(provider);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const authUrl = await getIntegrationAuthUrl(token, provider);
      window.location.href = authUrl;
    } catch {
      setBusyProvider(null);
    }
  };

  const handleDisconnect = async (provider: IntegrationProvider) => {
    const def = definitions.find((d) => d.provider === provider);
    const name = def?.name ?? provider;
    if (!window.confirm(t.integrations.confirmDisconnect(name))) return;

    setBusyProvider(provider);
    try {
      const token = await getAccessToken();
      if (!token) return;
      await disconnectIntegration(token, provider);
      setConnections((prev) => prev.filter((c) => c.provider !== provider));
    } catch {
      // Error shown via toast in future
    } finally {
      setBusyProvider(null);
    }
  };

  if (loading && definitions.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-ink-muted" strokeWidth={2} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="surface p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="eyebrow">{t.integrations.eyebrow}</p>
            <h2 className="mt-1 text-[22px] font-semibold text-ink">{t.integrations.title}</h2>
            <p className="mt-1 text-[13px] text-ink-muted">{t.integrations.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="focus-ring flex items-center gap-2 rounded-control border border-ink-border px-3 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-paper-soft hover:text-ink disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
            {t.integrations.refresh}
          </button>
        </div>

        {notice ? (
          <div
            className={`mb-5 flex items-center gap-3 rounded-control border p-3 ${
              notice.type === "success"
                ? "border-amber-300 bg-amber-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            {notice.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" strokeWidth={2} />
            )}
            <p
              className={`text-[12px] ${
                notice.type === "success" ? "text-amber-900" : "text-red-900"
              }`}
            >
              {notice.message}
            </p>
          </div>
        ) : null}

        {error && definitions.length === 0 ? (
          <div className="rounded-control border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="text-[13px] text-amber-900">{error}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {definitions.map((def) => (
              <IntegrationCard
                key={def.provider}
                definition={def}
                connection={getConnectionFor(def.provider)}
                onConnect={() => void handleConnect(def.provider)}
                onDisconnect={() => void handleDisconnect(def.provider)}
                busy={busyProvider === def.provider}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
