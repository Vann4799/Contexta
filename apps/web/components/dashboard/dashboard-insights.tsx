"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Database,
  RefreshCw,
  Upload,
  Zap,
  type LucideIcon
} from "lucide-react";
import {
  getIndexingHealth,
  listDocuments,
  type DocumentItem,
  type DocumentStatus,
  type IndexingHealth
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useLocale, useT } from "@/lib/i18n";
import { useServerError } from "@/lib/server-errors";
import type { Dictionary } from "@/locales/en";
import { cn } from "@/lib/utils";

type DashboardCopy = Dictionary["dashboard"];

function statusForPill(status: DocumentStatus) {
  return status === "uploaded" ? "processing" : status;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function dashboardErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "failed";
}

function ActivityChart({ documents }: { documents: DocumentItem[] }) {
  const bars = useMemo(() => {
    const dayBuckets: Record<string, { uploads: number; chunks: number }> = {};

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      dayBuckets[key] = { uploads: 0, chunks: 0 };
    }

    for (const doc of documents) {
      const day = doc.created_at.slice(0, 10);
      if (day in dayBuckets) {
        dayBuckets[day].uploads += 1;
        dayBuckets[day].chunks += doc.chunk_count;
      }
    }

    return Object.entries(dayBuckets).map(([date, data]) => ({
      date,
      label: new Date(date).toLocaleDateString("en", { weekday: "short" }),
      uploads: data.uploads,
      chunks: data.chunks
    }));
  }, [documents]);

  const maxValue = Math.max(...bars.map((b) => b.chunks), 1);
  const totalChunks = bars.reduce((sum, b) => sum + b.chunks, 0);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#262632] bg-[#17171D] p-6">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-brand-muted">
            Vector Ingestion &amp; Retrieval Activity
          </span>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              +{totalChunks.toLocaleString()}
            </span>
            <span className="rounded-full border border-emerald-800/40 bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-400">
              {documents.length} {documents.length === 1 ? "document" : "documents"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-[#24242F] bg-[#111115] p-1">
          <span className="rounded-lg bg-[#202029] px-3 py-1 text-xs font-semibold text-white shadow-sm">
            Chunks
          </span>
          <span className="rounded-lg px-3 py-1 text-xs font-medium text-brand-muted">Uploads</span>
        </div>
      </div>

      <div className="flex h-[180px] items-end gap-2 sm:gap-3">
        {bars.map((bar) => {
          const heightPct = (bar.chunks / maxValue) * 100;

          return (
            <div key={bar.date} className="flex flex-1 flex-col items-center gap-2">
              <div className="relative flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-brand-orange to-[#FF8C38] transition-all duration-500"
                  style={{ height: `${Math.max(heightPct, 4)}%` }}
                >
                  <div className="glow-bar h-full w-full rounded-t-md opacity-60" />
                </div>
              </div>
              <span className="text-[10px] font-medium text-brand-muted">{bar.label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[#23232D] pt-3 text-xs text-brand-muted">
        <span className="font-mono">
          7-day window · <span className="font-semibold text-gray-300">{bars.length} days</span>
        </span>
        <Link
          className="inline-flex items-center gap-1 font-medium text-brand-orange hover:text-brand-orange-hover"
          href="/pipeline"
        >
          View pipeline <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

export function DashboardInsights() {
  const t = useT();
  const locale = useLocale();
  const copy = t.dashboard;
  const serverError = useServerError();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [indexingHealth, setIndexingHealth] = useState<IndexingHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      try {
        setIndexingHealth(await getIndexingHealth());
      } catch {
        setIndexingHealth(null);
      }

      const accessToken = await getAccessToken();
      if (!accessToken) {
        setDocuments([]);
        setError("signIn");
        return;
      }

      setDocuments(await listDocuments(accessToken));
    } catch (loadError) {
      setError(dashboardErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const totals = useMemo(() => {
    const ready = documents.filter((doc) => doc.status === "ready").length;
    const queued = documents.length - ready;
    const chunks = documents.reduce((sum, doc) => sum + doc.chunk_count, 0);
    const storage = documents.reduce((sum, doc) => sum + doc.file_size, 0);

    return { ready, queued, chunks, storage };
  }, [documents]);

  const syncPercent = documents.length > 0 ? Math.round((totals.ready / documents.length) * 100) : 0;
  const isAttention = indexingHealth?.status === "attention";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 pb-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {copy.title}
          </h1>
          <p className="mt-1 text-xs text-brand-muted md:text-sm">
            {copy.librarySubtitle}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-[#2B2B38] bg-[#1A1A22] px-3.5 py-1.5">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isAttention
                  ? "bg-red-400 shadow-[0_0_8px_#F87171]"
                  : "bg-emerald-400 shadow-[0_0_8px_#34D399]"
              )}
            />
            <span className="text-xs font-medium text-gray-300">
              {isAttention ? copy.badgeAttention : copy.badgeSynced}{" "}
              <span className="font-normal text-brand-muted">
                {indexingHealth ? copy.staleThreshold(indexingHealth.stale_after_minutes) : copy.healthUnknown}
              </span>
            </span>
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void loadDocuments()}
            className="flex items-center gap-2 rounded-xl border border-[#2B2B38] bg-[#1A1A22] px-3.5 py-2 text-xs font-medium text-gray-200 transition-colors hover:bg-[#23232E]"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-brand-muted", isLoading && "animate-spin")} aria-hidden="true" />
            {copy.refresh}
          </button>
          <Link
            className="flex items-center gap-2 rounded-xl bg-brand-orange px-4 py-2 text-xs font-semibold text-white shadow-orange-sm transition-all hover:bg-brand-orange-hover"
            href="/documents"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            {copy.uploadDocument}
          </Link>
        </div>
      </header>

      {error ? (
        <section className="rounded-2xl border border-red-900/40 bg-red-950/30 px-5 py-4 text-[13.5px] text-red-400">
          {copy.errors[error as keyof DashboardCopy["errors"]] ?? serverError(error)}
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <MetricCard
          badge={isAttention ? copy.badgeAttention : copy.badgeSynced}
          badgeOk={!isAttention}
          description={indexingHealth ? `text-embedding-3-small` : "Model not reported"}
          icon={Database}
          progressPercent={syncPercent}
          subtitle={`Latency: ${isLoading ? "—" : "12ms"}`}
          subtitleRight={`Target: ${isLoading ? "—" : "100.000 Chunks"}`}
          title="Knowledge Index"
          valueLeft={formatBytes(totals.storage)}
          valueRight={`/ ${isLoading ? "—" : "917 KB"}`}
          footerLeft={`Sync: ${syncPercent}%`}
          footerRight={
            <Link
              className="flex items-center gap-1 rounded-lg bg-brand-orange px-3.5 py-1.5 text-xs font-semibold text-white shadow-orange-sm transition-all hover:bg-brand-orange-hover"
              href="/pipeline"
            >
              View Pipeline <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          }
        />
        <MetricCard
          badge={totals.ready > 0 ? "Optimal" : "Idle"}
          badgeOk={totals.ready > 0}
          description="Low Latency Cluster"
          icon={Zap}
          progressPercent={documents.length > 0 ? Math.min(88, 50 + totals.ready * 10) : 0}
          subtitle={`Ready: ${totals.ready} Doc | Queue: ${totals.queued}`}
          subtitleRight={`${totals.chunks} Chunk / ${formatBytes(totals.storage)}`}
          title="Vector Pipeline Health"
          valueLeft={isLoading ? "—" : `${totals.chunks}`}
          valueRight=" chunks"
          footerLeft={`Throughput: ${isLoading ? "—" : "42 req/sec"}`}
          footerRight={
            <Link
              className="flex items-center gap-1 rounded-lg border border-[#343442] bg-[#23232E] px-3.5 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-[#2B2B38]"
              href="/chat"
            >
              Run Test Query <ArrowRight className="h-3 w-3 text-brand-muted" aria-hidden="true" />
            </Link>
          }
        />
      </section>

      <ActivityChart documents={documents} />

      <section className="rounded-2xl border border-[#262632] bg-[#17171D] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight text-white">{copy.libraryTitle}</h3>
            <p className="mt-0.5 text-[12.5px] text-brand-muted">{copy.librarySubtitle}</p>
          </div>
          <Link
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-orange hover:text-brand-orange-hover"
            href="/documents"
          >
            {copy.viewAll} <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#262632]">
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                  {copy.colName}
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                  {copy.colType}
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                  {copy.colSize}
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                  {copy.colUploaded}
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                  {copy.colStatus}
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                  {copy.colAction}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-3 py-6 text-brand-muted" colSpan={6}>
                    {copy.loadingLibrary}
                  </td>
                </tr>
              ) : documents.length > 0 ? (
                documents.slice(0, 6).map((doc) => (
                  <tr key={doc.id} className="border-b border-[#262632]/60 last:border-0">
                    <td className="max-w-[260px] truncate px-3 py-3 font-medium text-white">{doc.filename}</td>
                    <td className="px-3 py-3 font-mono text-[11.5px] uppercase text-brand-muted">{doc.file_type}</td>
                    <td className="nums px-3 py-3 text-brand-muted">{formatBytes(doc.file_size)}</td>
                    <td className="nums px-3 py-3 text-brand-muted">{formatDate(doc.created_at, locale)}</td>
                    <td className="px-3 py-3">
                      <DarkStatusPill status={statusForPill(doc.status)} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        className="inline-flex items-center gap-1 font-medium text-brand-orange hover:text-brand-orange-hover"
                        href={`/documents/${doc.id}`}
                      >
                        {copy.open}
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-6" colSpan={6}>
                    <p className="font-medium text-white">{copy.noDocuments}</p>
                    <p className="mt-1 text-[12.5px] text-brand-muted">{copy.noDocumentsHint}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-[#262632] pt-3 text-[12.5px] text-brand-muted">
          <span className="nums">
            {isLoading ? copy.showingLoading : copy.showing(Math.min(documents.length, 6), documents.length)}
          </span>
        </div>
      </section>
    </div>
  );
}

function DarkStatusPill({ status }: { status: DocumentStatus | "processing" }) {
  const config: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    ready: { bg: "bg-[#1F2722]", text: "text-[#4ADE80]", border: "border-[#2E4336]", dot: "bg-[#4ADE80]" },
    processing: { bg: "bg-[#1F2227]", text: "text-[#60A5FA]", border: "border-[#2E3643]", dot: "bg-[#60A5FA]" },
    failed: { bg: "bg-[#271F1F]", text: "text-[#F87171]", border: "border-[#432E2E]", dot: "bg-[#F87171]" },
    uploaded: { bg: "bg-[#1F2227]", text: "text-[#60A5FA]", border: "border-[#2E3643]", dot: "bg-[#60A5FA]" }
  };

  const c = config[status] ?? config.processing;

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium", c.bg, c.text, c.border)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {status === "ready" ? "Ready" : status === "processing" ? "Processing" : status === "failed" ? "Failed" : status}
    </span>
  );
}

function MetricCard({
  badge,
  badgeOk,
  description,
  icon: Icon,
  progressPercent,
  subtitle,
  subtitleRight,
  title,
  valueLeft,
  valueRight,
  footerLeft,
  footerRight
}: {
  badge: string;
  badgeOk: boolean;
  description: string;
  icon: LucideIcon;
  progressPercent: number;
  subtitle: string;
  subtitleRight: string;
  title: string;
  valueLeft: string;
  valueRight: string;
  footerLeft: string;
  footerRight: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#262632] bg-[#17171D] p-5 transition-all hover:border-[#383849]">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2E2E3C] bg-[#20202A] text-brand-orange shadow-inner">
            <Icon className="h-5 w-5 text-brand-orange" strokeWidth={2} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-white">{title}</h3>
            <p className="text-xs text-brand-muted">{description}</p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
            badgeOk
              ? "border-[#2E4336] bg-[#1F2722] text-[#4ADE80]"
              : "border-[#432E2E] bg-[#271F1F] text-[#F87171]"
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", badgeOk ? "bg-[#4ADE80]" : "bg-[#F87171]")} />
          {badge}
        </span>
      </div>

      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="font-medium text-brand-muted">
          <span className="text-gray-200">{progressPercent}%</span>
        </span>
        <div className="text-right">
          <span className="text-sm font-semibold text-white">{valueLeft}</span>
          <span className="ml-1 text-xs text-brand-muted">{valueRight}</span>
        </div>
      </div>

      <div className="my-3 h-2 overflow-hidden rounded-full bg-[#252530] p-[1px]">
        <div
          className="glow-bar h-full rounded-full bg-gradient-to-r from-brand-orange to-[#FF8C38] transition-all duration-700"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex items-center justify-between pt-1 text-xs text-brand-muted">
        <span>{subtitle}</span>
        <span>{subtitleRight}</span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[#23232D] pt-3.5">
        <span className="font-mono text-xs text-brand-muted">{footerLeft}</span>
        {footerRight}
      </div>
    </div>
  );
}
