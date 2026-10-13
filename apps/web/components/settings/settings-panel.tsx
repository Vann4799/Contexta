"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import Link from "next/link";
import {
  Bot,
  Check,
  CheckCircle2,
  Database,
  FileUp,
  Globe,
  HardDrive,
  KeyRound,
  Languages,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  AlertCircle,
  XCircle
} from "lucide-react";
import { getApiHealth, getIndexingHealth, getVectorHealth } from "@/lib/api";
import { localeOptions, setLocale, useLocale, useT } from "@/lib/i18n";
import type { Dictionary } from "@/locales/en";

type CheckState = "checking" | "ok" | "warn" | "down";
type SettingsCopy = Dictionary["settings"];
type StatusId = keyof SettingsCopy["services"];
type StatusWord = keyof SettingsCopy["words"];

type QueueCounts = {
  queued: number;
  processing: number;
  stale: number;
  minutes: number;
};

type StatusRow = {
  id: StatusId;
  state: CheckState;
  word: StatusWord;
  detail: string;
  queue: QueueCounts | null;
};

const STATUS_ICON: Record<CheckState, typeof CheckCircle2> = {
  checking: RefreshCw,
  ok: CheckCircle2,
  warn: AlertCircle,
  down: XCircle
};

const STATUS_COLOR: Record<CheckState, string> = {
  checking: "text-ink-muted",
  ok: "text-success-ink",
  warn: "text-warning",
  down: "text-danger"
};

function initialState(): StatusRow[] {
  return [
    { id: "api", state: "checking", word: "checking", detail: "pingHealth", queue: null },
    { id: "vector", state: "checking", word: "checking", detail: "pingVector", queue: null },
    { id: "indexing", state: "checking", word: "checking", detail: "pingIndexing", queue: null }
  ];
}

function statusDetail(row: StatusRow, copy: SettingsCopy) {
  if (row.queue) {
    return copy.details.queueCounts(row.queue.queued, row.queue.processing, row.queue.stale, row.queue.minutes);
  }
  const resolved = copy.details[row.detail as keyof SettingsCopy["details"]];
  return typeof resolved === "string" ? resolved : row.detail;
}

function SettingRow({ icon: Icon, label, value, mono }: { icon: typeof Server; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-paper-line py-4 last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-paper-chip">
          <Icon className="h-4 w-4 text-ink" strokeWidth={2} aria-hidden="true" />
        </div>
        <span className="text-[13px] font-medium text-ink-muted">{label}</span>
      </div>
      <span className={`text-[13px] font-medium text-ink ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

export function SettingsPanel() {
  const t = useT();
  const locale = useLocale();
  const copy = t.settings;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";
  const [statusRows, setStatusRows] = useState<StatusRow[]>(initialState());
  const [vectorCollection, setVectorCollection] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const runChecks = useCallback(async () => {
    const { data: session } = await getSupabaseBrowserClient().auth.getSession();
    setIsRefreshing(true);
    setStatusRows(initialState());

    const [api, vector, indexing] = await Promise.all([
      getApiHealth().catch(() => null),
      getVectorHealth().catch(() => null),
      getIndexingHealth(session?.session?.access_token).catch(() => null)
    ]);

    setVectorCollection(vector && vector.status === "ok" ? vector.collection || null : null);

    setStatusRows([
      {
        id: "api",
        state: api ? "ok" : "down",
        word: api ? "reachable" : "unreachable",
        detail: api ? api.service : "apiUnreachable",
        queue: null
      },
      {
        id: "vector",
        state: !vector ? "down" : vector.status === "ok" ? "ok" : "down",
        word: vector && vector.status === "ok" ? "reachable" : "unreachable",
        detail: !vector ? "unknown" : vector.status === "ok" ? "vectorOk" : "vectorUnreachable",
        queue: null
      },
      {
        id: "indexing",
        state: !indexing ? "down" : indexing.status === "ok" ? "ok" : "warn",
        word: !indexing ? "noAnswer" : indexing.status === "ok" ? "active" : "needsAttention",
        detail: !indexing ? "unknown" : "queueCounts",
        queue: indexing
          ? {
              queued: indexing.queued_documents,
              processing: indexing.processing_documents,
              stale: indexing.stale_processing_documents,
              minutes: indexing.stale_after_minutes
            }
          : null
      }
    ]);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pt-2">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 className="mt-2 text-[26px] font-semibold text-ink">{copy.title}</h2>
          <p className="mt-2 max-w-xl font-secondary text-[13px] text-ink-muted">{copy.description}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/api-keys"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-paper-line bg-paper px-3.5 text-[13px] font-medium text-ink transition hover:border-ink/30 hover:bg-paper-card"
          >
            <KeyRound className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            {copy.apiKeys}
          </Link>
        </div>
      </div>

      {/* Language Section */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Languages className="h-4 w-4 text-ink-muted" strokeWidth={2} aria-hidden="true" />
          <div>
            <h3 className="text-[15px] font-semibold text-ink">{copy.languageSectionTitle}</h3>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">{copy.languageSectionDesc}</p>
          </div>
        </div>
        <div className="rounded-xl border border-paper-line bg-paper-card px-5 py-5">
          <div className="flex flex-wrap gap-2">
            {localeOptions.map((option) => {
              const active = option.value === locale;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setLocale(option.value)}
                  className={`inline-flex h-10 items-center gap-2 rounded-control border px-4 text-[13px] font-medium transition-colors ${
                    active
                      ? "border-ink bg-night text-white"
                      : "border-paper-line bg-paper text-ink-muted hover:border-ink/30 hover:text-ink"
                  }`}
                >
                  {active ? <Check className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" /> : null}
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Configuration Section */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-ink-muted" strokeWidth={2} aria-hidden="true" />
          <h3 className="text-[15px] font-semibold text-ink">{copy.runtimeTitle}</h3>
        </div>
        <div className="rounded-xl border border-paper-line bg-paper-card">
          <div className="px-5 py-3">
            <SettingRow icon={Globe} label={copy.runtime.apiBaseUrl} value={apiBaseUrl} mono />
            <SettingRow icon={Database} label={copy.runtime.vectorCollection} value={vectorCollection ?? copy.runtime.vectorCollectionUnknown} mono />
            <SettingRow icon={FileUp} label={copy.runtime.supportedUploads} value={copy.runtime.supportedUploadsValue} />
            <SettingRow icon={Bot} label={copy.runtime.answerGeneration} value="DeepSeek API" />
          </div>
        </div>
      </section>

      {/* Infrastructure Section */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-ink-muted" strokeWidth={2} aria-hidden="true" />
          <h3 className="text-[15px] font-semibold text-ink">Infrastructure</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-paper-line bg-paper-card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-paper-chip">
                <Lock className="h-4 w-4 text-ink" strokeWidth={2} aria-hidden="true" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-ink">{copy.capabilities.authentication}</p>
                <p className="mt-0.5 text-[12.5px] text-ink-muted">{copy.capabilities.authenticationValue}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-paper-line bg-paper-card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-paper-chip">
                <HardDrive className="h-4 w-4 text-ink" strokeWidth={2} aria-hidden="true" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-ink">{copy.capabilities.documentStorage}</p>
                <p className="mt-0.5 text-[12.5px] text-ink-muted">{copy.capabilities.documentStorageValue}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-paper-line bg-paper-card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-paper-chip">
                <Database className="h-4 w-4 text-ink" strokeWidth={2} aria-hidden="true" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-ink">{copy.capabilities.vectorSearch}</p>
                <p className="mt-0.5 text-[12.5px] text-ink-muted">{copy.capabilities.vectorSearchValue}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-paper-line bg-paper-card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-paper-chip">
                <KeyRound className="h-4 w-4 text-ink" strokeWidth={2} aria-hidden="true" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-ink">{copy.capabilities.privateKeys}</p>
                <p className="mt-0.5 text-[12.5px] text-ink-muted">{copy.capabilities.privateKeysValue}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Service Status Section */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-ink-muted" strokeWidth={2} aria-hidden="true" />
            <h3 className="text-[15px] font-semibold text-ink">{copy.serviceTitle}</h3>
          </div>
          <button
            type="button"
            onClick={() => void runChecks()}
            disabled={isRefreshing}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-paper-line bg-paper px-3 text-[12.5px] font-medium text-ink-muted transition hover:border-ink/30 hover:text-ink disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            {isRefreshing ? copy.checking : copy.recheck}
          </button>
        </div>
        <div className="rounded-xl border border-paper-line bg-paper-card">
          <div className="divide-y divide-paper-line py-3">
            {statusRows.map((row) => {
              const Icon = STATUS_ICON[row.state];
              const label = copy.services[row.id];
              const word = copy.words[row.word];
              return (
                <div key={row.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${STATUS_COLOR[row.state]} ${row.state === "checking" ? "animate-spin" : ""}`} strokeWidth={2} aria-hidden="true" />
                    <div>
                      <p className="text-[13px] font-medium text-ink">{label}</p>
                      <p className="mt-0.5 text-[12px] text-ink-muted">{statusDetail(row, copy)}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
                    row.state === "ok" ? "bg-success-soft text-success-ink" :
                    row.state === "warn" ? "bg-warning-soft text-warning" :
                    row.state === "down" ? "bg-danger-soft text-danger" :
                    "bg-paper-chip text-ink-muted"
                  }`}>
                    {word}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security Note */}
      <section className="rounded-xl border border-warning/20 bg-warning/5 p-4">
        <div className="flex gap-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={2} aria-hidden="true" />
          <div>
            <p className="text-[13px] font-semibold text-ink">{copy.securityTitle}</p>
            <p className="mt-1 text-[12.5px] leading-5 text-ink-muted">{copy.securityBody}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
