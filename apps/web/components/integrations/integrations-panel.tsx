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
        <svg viewBox="0 0 122.8 122.8" className="h-8 w-8">
          <path fill="#E01E5A" d="M25.4 77.4c0 7-5.7 12.7-12.7 12.7S0 84.4 0 77.4s5.7-12.7 12.7-12.7h12.7v12.7zm6.4 0c0-7 5.7-12.7 12.7-12.7s12.7 5.7 12.7 12.7v32.7c0 7-5.7 12.7-12.7 12.7s-12.7-5.7-12.7-12.7V77.4z"/>
          <path fill="#36C5F0" d="M45.4 25.4c-7 0-12.7-5.7-12.7-12.7S38.4 0 45.4 0s12.7 5.7 12.7 12.7v12.7H45.4zm0 6.4c7 0 12.7 5.7 12.7 12.7s-5.7 12.7-12.7 12.7H12.7C5.7 57.2 0 51.5 0 44.5s5.7-12.7 12.7-12.7h32.7z"/>
          <path fill="#2EB67D" d="M97.4 45.4c0-7 5.7-12.7 12.7-12.7s12.7 5.7 12.7 12.7-5.7 12.7-12.7 12.7H97.4V45.4zm-6.4 0c0 7-5.7 12.7-12.7 12.7s-12.7-5.7-12.7-12.7V12.7C65.6 5.7 71.3 0 78.3 0S91 5.7 91 12.7v32.7z"/>
          <path fill="#ECB22E" d="M77.4 97.4c7 0 12.7 5.7 12.7 12.7s-5.7 12.7-12.7 12.7-12.7-5.7-12.7-12.7V97.4h12.7zm0-6.4c-7 0-12.7-5.7-12.7-12.7s5.7-12.7 12.7-12.7h32.7c7 0 12.7 5.7 12.7 12.7s-5.7 12.7-12.7 12.7H77.4z"/>
        </svg>
      );
    case "github":
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      );
    case "notion":
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
          <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28.047-.653V1.039c0-.373-.28-.653-.653-.606L6.277 1.5c-.7.046-1.307.326-1.82.746L.33 5.692c-.42.373-.373.84.047 1.12l4.082 2.846zm1.447 14.185c0 .42.327.7.747.42l1.633-1.167c.373-.28.467-.7.14-1.026l-.7-.84-2.1-1.447v4.06zm14.328-15.094l-12.602.84c-.56.046-.7.28-.7.7v12.834c0 .42.28.56.653.326l2.614-1.82c.326-.28.28-.7 0-1.073l-3.268-3.827c-.326-.373-.14-.7.28-.7h11.948c.42 0 .7-.28.7-.7V4.019c0-.373-.28-.7-.7-.7zm-7.513 11.667c0 .28-.233.513-.56.513H9.607c-.326 0-.42-.233-.186-.513l2.38-2.847c.233-.28.42-.047.42.233v2.614zm4.294-3.5c0 .28-.233.513-.513.513h-5.181c-.28 0-.42-.233-.233-.513l2.1-2.8c.233-.28.466-.233.466.047v2.753z"/>
        </svg>
      );
    case "google_drive":
      return (
        <svg viewBox="0 0 87.3 78" className="h-8 w-8">
          <path fill="#0066da" d="M43.65 25L29.3 0H72.2L57.9 25z"/>
          <path fill="#00ac47" d="M72.2 0L57.9 25l14.35 25L86.6 25z"/>
          <path fill="#ea4335" d="M14.35 50L0 75h28.7L43.05 50z"/>
          <path fill="#00832d" d="M43.05 50L28.7 75h42.9L57.25 50z"/>
          <path fill="#2684fc" d="M57.25 50L43.65 25 29.3 50z"/>
          <path fill="#ffba00" d="M0 75l14.35-25L28.7 75z"/>
        </svg>
      );
    default:
      return <Link2 className="h-8 w-8" strokeWidth={2} />;
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
