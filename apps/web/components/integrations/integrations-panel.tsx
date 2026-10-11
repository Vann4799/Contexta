"use client";

import { useCallback, useEffect, useState } from "react";
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
  connectIntegration,
  disconnectIntegration,
  getIntegrations,
} from "@/lib/api";
import { useT } from "@/lib/i18n";

function ProviderIcon({ provider }: { provider: string }) {
  switch (provider) {
    case "slack":
      return <MessageSquare className="h-5 w-5" strokeWidth={2} />;
    case "github":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
        </svg>
      );
    case "notion":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M4 4h10l6 6v10H4V4z" />
          <path d="M14 4v6h6" />
          <path d="M8 14h8" />
          <path d="M8 18h5" />
        </svg>
      );
    case "google_drive":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M8 4h8l4 7H4l4-7z" />
          <path d="M4 11l4 9h8" />
          <path d="M20 11l-4 9" />
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
  const [definitions, setDefinitions] = useState<IntegrationDefinition[]>([]);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<IntegrationProvider | null>(null);

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

  const getConnectionFor = (provider: IntegrationProvider) =>
    connections.find((c) => c.provider === provider);

  const handleConnect = async (provider: IntegrationProvider) => {
    setBusyProvider(provider);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const connection = await connectIntegration(token, provider);
      setConnections((prev) => {
        const filtered = prev.filter((c) => c.provider !== provider);
        return [...filtered, connection];
      });
    } catch {
      // Error shown via toast in future; for now just reset
    } finally {
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

        {error && definitions.length === 0 ? (
          <div className="rounded-control border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="text-[13px] text-amber-900">{error}</p>
          </div>
        ) : (
          <>
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
            <p className="mt-4 text-center text-[11px] text-ink-muted">
              {t.integrations.oauthNote}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
