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

type CheckState = "checking" | "ok" | "warn" | "down";

type StatusRow = {
  label: string;
  state: CheckState;
  word: string;
  detail: string;
};

const CHIP_CLASS: Record<CheckState, string> = {
  checking: "",
  ok: "bg-success-soft text-success-ink",
  warn: "bg-warning-soft text-warning",
  down: "bg-danger-soft text-danger"
};

function initialState(): StatusRow[] {
  return [
    { label: "API service", state: "checking", word: "Checking", detail: "Pinging /health" },
    { label: "Vector store", state: "checking", word: "Checking", detail: "Pinging /health/vector" },
    { label: "Indexing queue", state: "checking", word: "Checking", detail: "Reading /health/indexing" }
  ];
}

export function SettingsPanel() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";
  const [statusRows, setStatusRows] = useState<StatusRow[]>(initialState);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const runChecks = useCallback(async () => {
    setIsRefreshing(true);
    setStatusRows(initialState());

    const [api, vector, indexing] = await Promise.all([
      getApiHealth().catch(() => null),
      getVectorHealth().catch(() => null),
      getIndexingHealth().catch(() => null)
    ]);

    setStatusRows([
      {
        label: "API service",
        state: api ? "ok" : "down",
        word: api ? "Reachable" : "Unreachable",
        detail: api ? api.service : "The API did not answer /health."
      },
      {
        label: "Vector store",
        state: !vector ? "down" : vector.status === "ok" ? "ok" : "down",
        word: vector && vector.status === "ok" ? "Reachable" : "Unreachable",
        detail: !vector
          ? "Status unknown — no answer from the API."
          : vector.status === "ok"
            ? "Qdrant reported healthy."
            : "Qdrant is not reachable from the API."
      },
      {
        label: "Indexing queue",
        state: !indexing ? "down" : indexing.status === "ok" ? "ok" : "warn",
        word: !indexing ? "No answer" : indexing.status === "ok" ? "Active" : "Needs attention",
        detail: !indexing
          ? "Status unknown — no answer from the API."
          : `${indexing.queued_documents} queued, ${indexing.processing_documents} processing, ` +
            `${indexing.stale_processing_documents} stale over ${indexing.stale_after_minutes} min.`
      }
    ]);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  const runtimeItems = [
    { label: "API base URL", value: apiBaseUrl, icon: Server },
    { label: "Vector collection", value: "contexta_chunks", icon: Database },
    { label: "Supported uploads", value: "PDF and DOCX up to 50 MB", icon: FileUp },
    { label: "Answer generation", value: "DeepSeek API", icon: Bot }
  ];

  const capabilityItems = [
    { label: "Authentication", value: "Supabase email sign-in", icon: ShieldCheck },
    { label: "Document storage", value: "Supabase Storage", icon: HardDrive },
    { label: "Vector search", value: "Qdrant, called by the API", icon: Database },
    { label: "Private keys", value: "Server env only, never sent here", icon: KeyRound }
  ];

  return (
    <div className="space-y-3">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Workspace Settings</p>
          <h2 className="mt-2 text-[26px] font-semibold text-ink">System controls</h2>
          <p className="mt-2 max-w-2xl text-[13px] text-ink-muted">
            Read-only configuration for this workspace. Core secrets stay on the API server and are not exposed here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/settings/developer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-card border border-paper-line bg-paper px-4 text-[13px] font-semibold text-ink transition hover:border-ink"
          >
            <KeyRound className="h-4 w-4" strokeWidth={2.1} aria-hidden="true" />
            API keys
          </Link>
          <Link
            href="/documents"
            className="inline-flex h-10 items-center justify-center rounded-card border border-paper-line bg-paper-card px-4 text-[13px] font-semibold text-ink transition hover:border-ink hover:text-ink"
          >
            Manage documents
          </Link>
          <Link
            href="/chat"
            className="inline-flex h-10 items-center justify-center rounded-card border border-ink bg-night px-4 text-[13px] font-semibold text-white transition hover:bg-night-raised"
          >
            Open chat
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
              <h3 className="text-[17px] font-semibold text-ink">Runtime Status</h3>
              <p className="mt-1 text-[13px] text-ink-muted">Configuration currently used by the web app and API.</p>
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
            <h3 className="text-[17px] font-semibold text-ink">Edit access</h3>
            <div className="mt-4 rounded-control border border-paper-line bg-paper p-4">
              <p className="text-[13px] font-semibold text-ink">Nothing here is writable</p>
              <p className="mt-1 text-[13px] text-ink-muted">
                Changing these values means editing the API server environment and restarting the service.
              </p>
            </div>
          </article>

          <article className="rounded-card border border-paper-line bg-paper-card p-5">
            <h3 className="text-[17px] font-semibold text-ink">Security Note</h3>
            <p className="mt-3 text-[13px] leading-6 text-ink-muted">
              Supabase service role, DeepSeek key, and database credentials must stay in backend `.env` files. The web
              app should only receive public client settings.
            </p>
          </article>
        </aside>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {capabilityItems.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="rounded-card border border-paper-line bg-paper-card p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-card bg-paper-chip text-ink">
                <Icon className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-ink">{item.label}</h3>
              <p className="mt-1 text-[13px] text-ink-muted">{item.value}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-card border border-paper-line bg-paper-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[17px] font-semibold text-ink">Service Status</h3>
          <button
            type="button"
            onClick={() => void runChecks()}
            disabled={isRefreshing}
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-control border border-paper-line bg-paper px-3 text-[13px] font-semibold text-ink transition hover:border-ink disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            {isRefreshing ? "Checking" : "Re-check"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {statusRows.map((row) => (
            <div
              key={row.label}
              className="rounded-card border border-paper-line bg-paper p-4"
              role="status"
              aria-label={`${row.label}: ${row.word}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink">{row.label}</span>
                <span className={`chip ${CHIP_CLASS[row.state]}`}>{row.word}</span>
              </div>
              <p className="mt-2 text-[13px] leading-6 text-ink-muted">{row.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
