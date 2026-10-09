"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";
import {
  ArrowRight,
  Clock,
  Database,
  Files,
  HardDrive,
  Key,
  Layers,
  MessageSquare,
  RefreshCw,
  Search,
  Upload,
  Zap
} from "lucide-react";
import {
  getAccountSummary,
  getIndexingHealth,
  listDocuments,
  type AccountSummary,
  type DocumentItem,
  type DocumentStatus,
  type IndexingHealth
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useLocale, useT } from "@/lib/i18n";
import { useServerError } from "@/lib/server-errors";
import type { Dictionary } from "@/locales/en";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";

type DashboardCopy = Dictionary["dashboard"];

const STATUS_COLORS: Record<string, string> = {
  ready: "#c8a84b",
  processing: "#c8a84b",
  uploaded: "#8b8680",
  failed: "#b54a4a"
};

function statusForPill(status: DocumentStatus) {
  return status === "uploaded" ? "processing" : status;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
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

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(value));
}

function dashboardErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "failed";
}

interface DayBucket {
  date: string;
  label: string;
  uploads: number;
  indexed: number;
}

function buildActivityBuckets(documents: DocumentItem[]): DayBucket[] {
  const now = new Date();
  const days: DayBucket[] = [];

  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    days.push({
      date: key,
      label: new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(d),
      uploads: 0,
      indexed: 0
    });
  }

  for (const doc of documents) {
    const docDate = new Date(doc.created_at);
    const key = docDate.toISOString().slice(0, 10);
    const bucket = days.find((b) => b.date === key);
    if (bucket) {
      bucket.uploads += 1;
      if (doc.status === "ready") bucket.indexed += 1;
    }
  }

  return days;
}

export function DashboardInsights() {
  const t = useT();
  const locale = useLocale();
  const copy = t.dashboard;
  const serverError = useServerError();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [indexingHealth, setIndexingHealth] = useState<IndexingHealth | null>(null);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [libraryFilter, setLibraryFilter] = useState("");

  const getAccessToken = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const loadData = useCallback(async () => {
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
      const [docs, acctSummary] = await Promise.all([
        listDocuments(accessToken),
        getAccountSummary(accessToken).catch(() => null)
      ]);
      setDocuments(docs);
      setSummary(acctSummary);
    } catch (loadError) {
      setError(dashboardErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totals = useMemo(() => {
    const ready = documents.filter((d) => d.status === "ready").length;
    const failed = documents.filter((d) => d.status === "failed").length;
    const processing = documents.length - ready - failed;
    const chunks = documents.reduce((s, d) => s + d.chunk_count, 0);
    const storage = documents.reduce((s, d) => s + d.file_size, 0);
    return { ready, failed, processing, chunks, storage };
  }, [documents]);

  const activityBuckets = useMemo(() => buildActivityBuckets(documents), [documents]);
  const activityMax = useMemo(
    () => Math.max(...activityBuckets.map((d) => Math.max(d.uploads, d.indexed)), 1),
    [activityBuckets]
  );
  const yAxisMax = useMemo(() => {
    const tiers = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
    for (const t of tiers) {
      if (activityMax <= t) return t;
    }
    return Math.ceil(activityMax / 1000) * 1000;
  }, [activityMax]);
  const yAxisLabels = useMemo(() => {
    const step = yAxisMax <= 10 ? 2 : yAxisMax <= 50 ? 10 : yAxisMax <= 200 ? 50 : Math.round(yAxisMax / 5);
    const labels: number[] = [];
    for (let v = yAxisMax; v >= 0; v -= step) labels.push(v);
    if (labels[labels.length - 1] !== 0) labels.push(0);
    return labels;
  }, [yAxisMax]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const statusData = useMemo(() => {
    const items = [
      { name: copy.statusReady, value: totals.ready, color: STATUS_COLORS.ready },
      { name: copy.statusProcessing, value: totals.processing, color: STATUS_COLORS.processing },
      { name: copy.statusFailed, value: totals.failed, color: STATUS_COLORS.failed }
    ].filter((i) => i.value > 0);
    return items.length > 0 ? items : [{ name: copy.statusReady, value: 1, color: "#d4d0c8" }];
  }, [totals, copy]);

  const normalizedLibraryFilter = libraryFilter.trim().toLowerCase();
  const filteredDocuments = normalizedLibraryFilter
    ? documents.filter((d) =>
        [d.filename, d.file_type, d.status, t.common.status[statusForPill(d.status)]].some((v) =>
          v.toLowerCase().includes(normalizedLibraryFilter)
        )
      )
    : documents;
  const libraryDocuments = filteredDocuments.slice(0, 8);

  const topMetrics = [
    { label: copy.stats.documents, value: String(documents.length), icon: Files, accent: "text-accent" },
    { label: copy.stats.chunks, value: String(totals.chunks), icon: Layers, accent: "text-[#c8a84b]" },
    { label: copy.stats.storage, value: formatBytes(totals.storage), icon: HardDrive, accent: "text-[#6b5b95]" },
    { label: copy.metricApiReqs, value: String(summary?.developer.api_requests_14d ?? 0), icon: Key, accent: "text-[#c8a84b]" }
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Header bar */}
      <section className="surface flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-night shadow-root">
            <Database className="h-6 w-6 text-accent" strokeWidth={2.2} aria-hidden="true" />
            <span
              className={cn(
                "absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white",
                indexingHealth?.status === "attention" ? "bg-danger" : "animate-pulse-dot bg-accent"
              )}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="eyebrow">{copy.indexEyebrow}</span>
              <span
                className={cn(
                  "rounded px-1.5 py-[1px] text-[10px] font-bold tracking-[0.06em]",
                  indexingHealth?.status === "attention"
                    ? "bg-danger-soft text-danger"
                    : "bg-accent text-ink"
                )}
              >
                {indexingHealth?.status === "attention" ? copy.badgeAttention : copy.badgeSynced}
              </span>
            </div>
            <h2 className="mt-0.5 text-[18px] font-semibold tracking-tight">{copy.title}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button disabled={isLoading} onClick={() => void loadData()} variant="secondary">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {copy.refresh}
          </Button>
          <Link
            className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-control bg-night px-4 text-[13px] font-medium leading-none text-white shadow-node transition-colors hover:bg-night-raised"
            href="/documents"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            {copy.uploadDocument}
          </Link>
        </div>
      </section>

      {error ? (
        <section className="rounded-card border border-danger-line bg-danger-soft px-5 py-4 text-[13.5px] text-danger">
          {copy.errors[error as keyof DashboardCopy["errors"]] ?? serverError(error)}
        </section>
      ) : null}

      {/* Metric cards row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {topMetrics.map((m) => (
          <article key={m.label} className="surface flex items-center gap-4 px-5 py-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-paper-chip">
              <m.icon className={cn("h-5 w-5", m.accent)} strokeWidth={2} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <dt className="eyebrow text-[10.5px]">{m.label}</dt>
              <dd className="mt-0.5 nums text-[26px] font-semibold leading-none tracking-tight">
                {isLoading ? "—" : m.value}
              </dd>
            </div>
          </article>
        ))}
      </div>

      {/* Charts row: Activity + Status donut */}
      <div className="grid gap-3 lg:grid-cols-12">
        <article className="surface min-w-0 p-5 lg:col-span-8">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">{copy.activityTitle}</h3>
              <p className="mt-0.5 text-[12px] text-ink-muted">{copy.activitySubtitle}</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-ink-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent" />
                {copy.activityUploads}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#c8a84b]" />
                {copy.activityIndexed}
              </span>
            </div>
          </div>
          <div className="relative h-[220px] w-full">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-[13px] text-ink-muted">Loading...</div>
            ) : (
              <>
                <div className="relative h-[190px] w-full">
                  {/* Y-axis labels */}
                  <div className="absolute left-0 top-0 flex h-full flex-col justify-between pr-2 text-[10px] text-ink-muted nums">
                    {yAxisLabels.map((n) => (
                      <span key={n}>{n}</span>
                    ))}
                  </div>
                  <div className="ml-6 h-full">
                    <svg
                      className="h-full w-full"
                      viewBox={`0 0 ${activityBuckets.length * 40} 190`}
                      preserveAspectRatio="none"
                    >
                      {/* Grid lines */}
                      {yAxisLabels.map((n) => {
                        const y = 185 - (n / yAxisMax) * 180;
                        return (
                          <line
                            key={`grid-${n}`}
                            x1="0"
                            y1={y}
                            x2={activityBuckets.length * 40}
                            y2={y}
                            stroke="currentColor"
                            className="text-paper-line/40"
                            strokeWidth="1"
                          />
                        );
                      })}
                      {/* Uploads area */}
                      <path
                        fill="#f2fb48"
                        fillOpacity="0.1"
                        d={`${activityBuckets
                          .map((b, i) => {
                            const x = i * 40 + 20;
                            const y = 185 - (b.uploads / yAxisMax) * 180;
                            return `${i === 0 ? "M" : "L"} ${x},${y}`;
                          })
                          .join(" ")} L ${(activityBuckets.length - 1) * 40 + 20},185 L 20,185 Z`}
                      />
                      {/* Indexed area */}
                      <path
                        fill="#c8a84b"
                        fillOpacity="0.1"
                        d={`${activityBuckets
                          .map((b, i) => {
                            const x = i * 40 + 20;
                            const y = 185 - (b.indexed / yAxisMax) * 180;
                            return `${i === 0 ? "M" : "L"} ${x},${y}`;
                          })
                          .join(" ")} L ${(activityBuckets.length - 1) * 40 + 20},185 L 20,185 Z`}
                      />
                      {/* Uploads smooth line */}
                      <path
                        fill="none"
                        stroke="#f2fb48"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={activityBuckets
                          .map((b, i) => {
                            const x = i * 40 + 20;
                            const y = 185 - (b.uploads / yAxisMax) * 180;
                            if (i === 0) return `M ${x},${y}`;
                            const prevX = (i - 1) * 40 + 20;
                            const prevY = 185 - (activityBuckets[i - 1].uploads / yAxisMax) * 180;
                            const cpx1 = prevX + 13;
                            const cpx2 = x - 13;
                            return `C ${cpx1},${prevY} ${cpx2},${y} ${x},${y}`;
                          })
                          .join(" ")}
                      />
                      {/* Indexed smooth line */}
                      <path
                        fill="none"
                        stroke="#c8a84b"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={activityBuckets
                          .map((b, i) => {
                            const x = i * 40 + 20;
                            const y = 185 - (b.indexed / yAxisMax) * 180;
                            if (i === 0) return `M ${x},${y}`;
                            const prevX = (i - 1) * 40 + 20;
                            const prevY = 185 - (activityBuckets[i - 1].indexed / yAxisMax) * 180;
                            const cpx1 = prevX + 13;
                            const cpx2 = x - 13;
                            return `C ${cpx1},${prevY} ${cpx2},${y} ${x},${y}`;
                          })
                          .join(" ")}
                      />
                      {/* Hover zones */}
                      {activityBuckets.map((b, i) => (
                        <rect
                          key={`hover-${i}`}
                          x={i * 40}
                          y="0"
                          width="40"
                          height="190"
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredIndex(i)}
                          onMouseLeave={() => setHoveredIndex(null)}
                        />
                      ))}
                      {/* Data points for uploads */}
                      {activityBuckets.map((b, i) => {
                        const x = i * 40 + 20;
                        const y = 185 - (b.uploads / yAxisMax) * 180;
                        return (
                          <circle
                            key={`up-${i}`}
                            cx={x}
                            cy={y}
                            r="4"
                            fill="#f2fb48"
                            className="pointer-events-none"
                          />
                        );
                      })}
                      {/* Data points for indexed */}
                      {activityBuckets.map((b, i) => {
                        const x = i * 40 + 20;
                        const y = 185 - (b.indexed / yAxisMax) * 180;
                        return (
                          <circle
                            key={`idx-${i}`}
                            cx={x}
                            cy={y}
                            r="4"
                            fill="#c8a84b"
                            className="pointer-events-none"
                          />
                        );
                      })}
                      {/* Hover line */}
                      {hoveredIndex !== null && (
                        <line
                          x1={hoveredIndex * 40 + 20}
                          y1="5"
                          x2={hoveredIndex * 40 + 20}
                          y2="185"
                          stroke="currentColor"
                          className="text-paper-line"
                          strokeWidth="1"
                          strokeDasharray="4 2"
                        />
                      )}
                    </svg>
                  </div>
                  {/* Tooltip */}
                  {hoveredIndex !== null && (
                    <div
                      className="absolute z-20 -translate-x-1/2 whitespace-nowrap rounded-lg border border-paper-line bg-paper-card px-3 py-2 text-[12px] shadow-node"
                      style={{
                        left: `calc(${(hoveredIndex * 40 + 20) / (activityBuckets.length * 40) * 100}% + 24px)`,
                        top: "10px"
                      }}
                    >
                      <p className="mb-1 font-medium text-ink-muted">{activityBuckets[hoveredIndex].date}</p>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-accent" />
                        <span className="text-ink-muted">{copy.activityUploads}:</span>
                        <span className="font-semibold nums">{activityBuckets[hoveredIndex].uploads}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#c8a84b]" />
                        <span className="text-ink-muted">{copy.activityIndexed}:</span>
                        <span className="font-semibold nums">{activityBuckets[hoveredIndex].indexed}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="ml-6 flex gap-[6px] px-1 pt-1.5">
                  {activityBuckets.map((b) => (
                    <div key={b.date} className="flex-1 text-center text-[10px] text-ink-muted nums">
                      {b.label}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </article>

        <article className="surface flex min-w-0 flex-col p-5 lg:col-span-4">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight">{copy.statusTitle}</h3>
            <p className="mt-0.5 text-[12px] text-ink-muted">{copy.statusSubtitle}</p>
          </div>
          <div className="flex flex-1 items-center gap-4">
            <div className="h-[180px] w-[180px] shrink-0">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-[13px] text-ink-muted">—</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {statusData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const d = payload[0].payload as { name: string; value: number };
                        return (
                          <div className="rounded-lg border border-paper-line bg-paper-card px-3 py-1.5 text-[12px] shadow-node">
                            <span className="font-medium">{d.name}:</span>{" "}
                            <span className="nums font-semibold">{d.value}</span>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex flex-col gap-2 text-[12.5px]">
              {statusData.map((s) => (
                <div key={s.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                  <span className="text-ink-muted">{s.name}</span>
                  <span className="nums ml-auto font-semibold">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>

      {/* Document library table */}
      <section className="grid gap-3 lg:grid-cols-12">
        <article className="surface min-w-0 p-5 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">{copy.libraryTitle}</h3>
              <p className="mt-0.5 text-[12px] text-ink-muted">{copy.librarySubtitle}</p>
            </div>
            <label className="relative block w-full sm:max-w-[200px]">
              <span className="sr-only">{copy.filterLabel}</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                strokeWidth={2}
                aria-hidden="true"
              />
              <input
                className="focus-ring h-9 w-full rounded-control border border-paper-line bg-paper-soft pl-9 pr-3 text-[13px] placeholder:text-ink-faint"
                placeholder={copy.filterPlaceholder}
                type="search"
                value={libraryFilter}
                onChange={(e) => setLibraryFilter(e.target.value)}
              />
            </label>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[580px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-paper-line">
                  <th className="eyebrow px-3 py-2 font-semibold">{copy.colName}</th>
                  <th className="eyebrow px-3 py-2 font-semibold">{copy.colType}</th>
                  <th className="eyebrow px-3 py-2 font-semibold">{copy.colSize}</th>
                  <th className="eyebrow px-3 py-2 font-semibold">{copy.colUploaded}</th>
                  <th className="eyebrow px-3 py-2 font-semibold">{copy.colStatus}</th>
                  <th className="eyebrow px-3 py-2 text-right font-semibold">{copy.colAction}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="px-3 py-6 text-ink-muted" colSpan={6}>{copy.loadingLibrary}</td>
                  </tr>
                ) : libraryDocuments.length > 0 ? (
                  libraryDocuments.map((doc) => (
                    <tr key={doc.id} className="border-b border-paper-line/60 last:border-0">
                      <td className="max-w-[240px] truncate px-3 py-3 font-medium">{doc.filename}</td>
                      <td className="px-3 py-3 font-mono text-[11.5px] uppercase text-ink-muted">{doc.file_type}</td>
                      <td className="nums px-3 py-3 text-ink-muted">{formatBytes(doc.file_size)}</td>
                      <td className="nums px-3 py-3 text-ink-muted">{formatDate(doc.created_at, locale)}</td>
                      <td className="px-3 py-3"><StatusPill status={statusForPill(doc.status)} /></td>
                      <td className="px-3 py-3 text-right">
                        <Link className="inline-flex items-center gap-1 font-medium text-ink hover:underline" href={`/documents/${doc.id}`}>
                          {copy.open}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-6" colSpan={6}>
                      <p className="font-medium">{documents.length > 0 ? copy.noMatching : copy.noDocuments}</p>
                      <p className="mt-1 text-[12.5px] text-ink-muted">
                        {documents.length > 0 ? copy.noMatchingHint : copy.noDocumentsHint}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-paper-line pt-3 text-[12.5px] text-ink-muted">
            <span className="nums">
              {isLoading ? copy.showingLoading : copy.showing(libraryDocuments.length, filteredDocuments.length)}
            </span>
            <Link className="inline-flex items-center gap-1 font-medium text-ink hover:underline" href="/documents">
              {copy.viewAll}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </article>

        {/* Right side: recent + quick actions */}
        <div className="flex min-w-0 flex-col gap-3 lg:col-span-4">
          <article className="surface p-5">
            <h3 className="text-[15px] font-semibold tracking-tight">{copy.recentTitle}</h3>
            <div className="mt-3 flex flex-col gap-1">
              {isLoading ? (
                <p className="text-[12.5px] text-ink-muted">{copy.loadingRecent}</p>
              ) : documents.slice(0, 4).length > 0 ? (
                documents.slice(0, 4).map((doc) => (
                  <Link
                    key={doc.id}
                    className="focus-ring flex items-start gap-3 rounded-control px-2 py-2 transition-colors hover:bg-paper-chip"
                    href={`/documents/${doc.id}`}
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-control bg-night text-accent">
                      <Files className="h-4 w-4" strokeWidth={2.1} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{doc.filename}</span>
                      <span className="nums block truncate text-[11.5px] text-ink-muted">
                        {copy.chunkCount(doc.chunk_count)} · {formatShortDate(doc.created_at)}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <p className="rounded-control bg-paper-chip px-3 py-2.5 text-[12.5px] text-ink-muted">{copy.uploadFirst}</p>
              )}
            </div>
          </article>

          <article className="surface p-5">
            <h3 className="text-[15px] font-semibold tracking-tight">{copy.nextActionsTitle}</h3>
            <div className="mt-3 flex flex-col gap-2">
              {[
                { href: "/chat", label: copy.nextActions.chat, icon: MessageSquare },
                { href: "/convert", label: copy.convert, icon: Zap },
                { href: "/settings", label: copy.nextActions.profile, icon: Clock }
              ].map((action) => (
                <Link
                  key={action.href}
                  className="focus-ring flex items-center gap-2.5 rounded-control border border-paper-line bg-paper-soft px-3 py-2.5 text-[13px] font-medium transition-colors hover:bg-paper-card"
                  href={action.href}
                >
                  <action.icon className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{action.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-ink-faint" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
