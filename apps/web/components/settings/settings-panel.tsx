"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Database,
  FileUp,
  HardDrive,
  KeyRound,
  RefreshCw,
  Server,
  ShieldCheck,
  SlidersHorizontal
} from "lucide-react";
import { getApiHealth, getIndexingHealth, getVectorHealth } from "@/lib/api";
import { useT } from "@/lib/i18n";
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

const CHIP_CLASS: Record<CheckState, string> = {
  checking: "",
  ok: "bg-success-soft text-success-ink",
  warn: "bg-warning-soft text-warning",
  down: "bg-danger-soft text-danger"
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

export function SettingsPanel() {
  const t = useT();
  const copy = t.settings;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";
  const [statusRows, setStatusRows] = useState<StatusRow[]>(initialState);
  const [vectorCollection, setVectorCollection] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const runChecks = useCallback(async () => {
    setIsRefreshing(true);
    setStatusRows(initialState());

    const [api, vector, indexing] = await Promise.all([
      getApiHealth().catch(() => null),
      getVectorHealth().catch(() => null),
      getIndexingHealth().catch(() => null)
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

  const runtimeItems = [
    { label: copy.runtime.apiBaseUrl, value: apiBaseUrl, icon: Server },
    { label: copy.runtime.vectorCollection, value: vectorCollection ?? copy.runtime.vectorCollectionUnknown, icon: Database },
    { label: copy.runtime.supportedUploads, value: copy.runtime.supportedUploadsValue, icon: FileUp },
    { label: copy.runtime.answerGeneration, value: "DeepSeek API", icon: Bot }
  ];

  const capabilityItems = [
    { label: copy.capabilities.authentication, value: copy.capabilities.authenticationValue, icon: ShieldCheck },
    { label: copy.capabilities.documentStorage, value: copy.capabilities.documentStorageValue, icon: HardDrive },
    { label: copy.capabilities.vectorSearch, value: copy.capabilities.vectorSearchValue, icon: Database },
    { label: copy.capabilities.privateKeys, value: copy.capabilities.privateKeysValue, icon: KeyRound }
  ];

  return (
    <div className="space-y-3">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 className="mt-2 text-[26px] font-semibold text-ink">{copy.title}</h2>
          <p className="mt-2 max-w-2xl text-[13px] text-ink-muted">{copy.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/api-keys"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-card border border-paper-line bg-paper px-4 text-[13px] font-semibold text-ink transition hover:border-ink"
          >
            <KeyRound className="h-4 w-4" strokeWidth={2.1} aria-hidden="true" />
            {copy.apiKeys}
          </Link>
          <Link
            href="/documents"
            className="inline-flex h-10 items-center justify-center rounded-card border border-paper-line bg-paper-card px-4 text-[13px] font-semibold text-ink transition hover:border-ink hover:text-ink"
          >
            {copy.manageDocuments}
          </Link>
          <Link
            href="/chat"
            className="inline-flex h-10 items-center justify-center rounded-card border border-ink bg-night px-4 text-[13px] font-semibold text-white transition hover:bg-night-raised"
          >
            {copy.openChat}
          </Link>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-12">
        <article className="rounded-card border border-paper-line bg-paper-card p-6 lg:col-span-8">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-paper-chip text-ink">
              <SlidersHorizontal className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-[17px] font-semibold text-ink">{copy.runtimeTitle}</h3>
              <p className="mt-1 text-[13px] text-ink-muted">{copy.runtimeSubtitle}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {runtimeItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-control border border-paper-line bg-paper p-4">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                    <Icon className="h-4 w-4 text-ink" strokeWidth={2.1} aria-hidden="true" />
                    {item.label}
                  </div>
                  <div className="mt-3 rounded-control border border-paper-line bg-paper-card px-3 py-2 text-[13px] text-ink-muted">
                    {item.value}
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <aside className="space-y-4 lg:col-span-4">
          <article className="rounded-card border border-paper-line bg-paper-card p-5">
            <h3 className="text-[17px] font-semibold text-ink">{copy.editAccessTitle}</h3>
            <div className="mt-4 rounded-control border border-paper-line bg-paper p-4">
              <p className="text-[13px] font-semibold text-ink">{copy.editAccessHead}</p>
              <p className="mt-1 text-[13px] text-ink-muted">{copy.editAccessBody}</p>
            </div>
          </article>

          <article className="rounded-card border border-paper-line bg-paper-card p-5">
            <h3 className="text-[17px] font-semibold text-ink">{copy.securityTitle}</h3>
            <p className="mt-3 text-[13px] leading-6 text-ink-muted">{copy.securityBody}</p>
          </article>
        </aside>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {capabilityItems.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="rounded-card border border-paper-line bg-paper-card p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-card bg-paper-chip text-ink">
                <Icon className="h-5 w-5" strokeWidth={2.1} aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-ink">{item.label}</h3>
              <p className="mt-1 text-[13px] text-ink-muted">{item.value}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-card border border-paper-line bg-paper-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[17px] font-semibold text-ink">{copy.serviceTitle}</h3>
          <button
            type="button"
            onClick={() => void runChecks()}
            disabled={isRefreshing}
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-control border border-paper-line bg-paper px-3 text-[13px] font-semibold text-ink transition hover:border-ink disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            {isRefreshing ? copy.checking : copy.recheck}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {statusRows.map((row) => {
            const label = copy.services[row.id];
            const word = copy.words[row.word];
            return (
              <div
                key={row.id}
                className="rounded-card border border-paper-line bg-paper p-4"
                role="status"
                aria-label={`${label}: ${word}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink">{label}</span>
                  <span className={`chip ${CHIP_CLASS[row.state]}`}>{word}</span>
                </div>
                <p className="mt-2 text-[13px] leading-6 text-ink-muted">{statusDetail(row, copy)}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
