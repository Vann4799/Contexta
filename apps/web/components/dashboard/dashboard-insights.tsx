"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
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
  markAllNotificationsRead,
  markNotificationRead,
  getNotifications,
  type AccountSummary,
  type DocumentItem,
  type DocumentStatus,
  type IndexingHealth,
  type NotificationItem
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { fetchDocuments } from "@/lib/document-store";

import StatusDonut from "@/components/dashboard/status-donut";
import { useLocale, useT } from "@/lib/i18n";
import { useServerError } from "@/lib/server-errors";
import type { Dictionary } from "@/locales/en";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";

type DashboardCopy = Dictionary["dashboard"];

// Same yellow family, but each status has to read apart from the others in the ring.
const STATUS_COLORS: Record<string, string> = {
  ready: "#f2fb48",
  processing: "#e0a92e",
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

function relativeTime(dateString: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(dateString).getTime()) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function notificationHref(notification: NotificationItem): string | null {
  if (notification.type !== "document_ready" && notification.type !== "document_failed") {
    return null;
  }
  const documentId = (notification.metadata as { document_id?: string } | null)?.document_id;
  return documentId ? `/documents/${documentId}` : null;
}

function DashboardNotifications() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const getAccessToken = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const result = await getNotifications(token, 10);
      setNotifications(result.notifications);
      setUnreadCount(result.unread_count);
    } catch {
      // Notifications are not critical; fail silently.
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!(event.target as HTMLElement).closest("[data-notification]")) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
      return () => document.removeEventListener("mousedown", onClickOutside);
    }
  }, [open]);

  const handleMarkAllRead = async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      await markAllNotificationsRead(token);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Fail silently.
    }
  };

  const handleOpenNotification = async (notification: NotificationItem) => {
    const href = notificationHref(notification);
    if (!notification.read) {
      try {
        const token = await getAccessToken();
        if (token) {
          await markNotificationRead(token, notification.id);
          setNotifications((prev) =>
            prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
          );
          setUnreadCount((count) => Math.max(0, count - 1));
        }
      } catch {
        // Fail silently.
      }
    }
    setOpen(false);
    if (href) router.push(href);
  };

  return (
    <div className="relative" data-notification>
      <button
        type="button"
        aria-label={t.shell.notifications}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="focus-ring relative grid h-9 w-9 place-items-center rounded-control border border-paper-line bg-paper-card text-ink-muted transition-colors hover:bg-paper-soft hover:text-ink"
      >
        <Bell className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-night">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="surface absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] p-2">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              {t.shell.notifications}
            </p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="text-[10px] font-medium text-ink-muted hover:text-ink"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="flex max-h-[22rem] flex-col gap-0.5 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-2.5 py-2 text-[12px] text-ink-muted">{t.shell.noNotifications}</p>
            ) : (
              notifications.map((notification) => {
                const href = notificationHref(notification);
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void handleOpenNotification(notification)}
                    className={`rounded-control px-2.5 py-2 text-left text-[12px] transition-colors hover:bg-paper-soft ${
                      notification.read ? "text-ink-muted" : "text-ink"
                    }`}
                  >
                    <p className="font-medium">{notification.title}</p>
                    {notification.message ? (
                      <p className="mt-0.5 text-[11px]">{notification.message}</p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-ink-muted">
                      {relativeTime(notification.created_at)}
                      {href ? " · →" : ""}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
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

  const loadData = useCallback(async (options: { force?: boolean } = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setDocuments([]);
        setError("signIn");
        return;
      }
      const [docs, acctSummary, health] = await Promise.all([
        fetchDocuments(accessToken, options),
        getAccountSummary(accessToken).catch(() => null),
        getIndexingHealth(accessToken).catch(() => null)
      ]);
      setDocuments(docs);
      setSummary(acctSummary);
      setIndexingHealth(health);
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
    return [
      { name: copy.statusReady, value: totals.ready, color: STATUS_COLORS.ready },
      { name: copy.statusProcessing, value: totals.processing, color: STATUS_COLORS.processing },
      { name: copy.statusFailed, value: totals.failed, color: STATUS_COLORS.failed }
    ].filter((i) => i.value > 0);
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

  const sideMetrics = [
    { label: copy.stats.chunks, value: String(totals.chunks), icon: Layers },
    { label: copy.stats.storage, value: formatBytes(totals.storage), icon: HardDrive },
    { label: copy.metricApiReqs, value: String(summary?.developer.api_requests_14d ?? 0), icon: Key }
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
                indexingHealth?.status === "attention" ? "bg-accent" : "animate-pulse-dot bg-accent"
              )}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="eyebrow">{copy.indexEyebrow}</span>
              <span className="rounded bg-accent px-1.5 py-[1px] text-[10px] font-bold tracking-[0.06em] text-ink">
                {indexingHealth?.status === "attention" ? copy.badgeAttention : copy.badgeSynced}
              </span>
            </div>
            <h2 className="mt-0.5 text-[18px] font-semibold tracking-tight">{copy.title}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DashboardNotifications />
          <Button disabled={isLoading} onClick={() => void loadData({ force: true })} variant="secondary">
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
        <section className="rounded-card border border-[#8b8680]/30 bg-[#8b8680]/10 px-5 py-4 text-[13.5px] text-ink">
          {copy.errors[error as keyof DashboardCopy["errors"]] ?? serverError(error)}
        </section>
      ) : null}

      {/* Bento row 1: Hero stat + Donut + Stacked metrics */}
      <div className="grid gap-3 lg:grid-cols-12">
        {/* Hero stat card — dark bg */}
        <article className="relative flex min-w-0 flex-col justify-between overflow-hidden rounded-[var(--radius-card)] bg-night p-6 text-white shadow-root lg:col-span-5">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-accent/10" aria-hidden="true" />
          <div className="absolute -right-2 top-12 h-20 w-20 rounded-full bg-accent/5" aria-hidden="true" />
          <div className="relative z-10">
            <span className="eyebrow text-[10.5px] text-white/50">{copy.stats.documents}</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="nums text-[56px] font-semibold leading-none tracking-tighter text-accent">
                {isLoading ? "—" : documents.length}
              </span>
              <span className="text-[13px] text-white/40">files</span>
            </div>
          </div>
          <div className="relative z-10 mt-6 flex items-center gap-6 border-t border-white/10 pt-4">
            <div>
              <span className="block text-[10.5px] text-white/40">{copy.stats.chunks}</span>
              <span className="nums text-[18px] font-semibold leading-tight">{isLoading ? "—" : totals.chunks}</span>
            </div>
            <div className="h-6 w-px bg-white/10" aria-hidden="true" />
            <div>
              <span className="block text-[10.5px] text-white/40">{copy.stats.storage}</span>
              <span className="nums text-[18px] font-semibold leading-tight">{isLoading ? "—" : formatBytes(totals.storage)}</span>
            </div>
            <div className="h-6 w-px bg-white/10" aria-hidden="true" />
            <div>
              <span className="block text-[10.5px] text-white/40">{copy.statusReady}</span>
              <span className="nums text-[18px] font-semibold leading-tight text-accent">{isLoading ? "—" : totals.ready}</span>
            </div>
          </div>
        </article>

        {/* Donut chart — compact */}
        <article className="surface flex min-w-0 flex-col p-5 lg:col-span-3">
          <h3 className="text-[14px] font-semibold tracking-tight">{copy.statusTitle}</h3>
          <p className="mt-0.5 text-[11px] text-ink-muted">{copy.statusSubtitle}</p>
          <div className="mt-3 flex flex-1 items-center justify-center">
            <div className="h-[130px] w-[130px]">
              <StatusDonut items={isLoading ? [] : statusData} />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px]">
            {statusData.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                <span className="text-ink-muted">{s.name}</span>
                <span className="nums font-semibold">{s.value}</span>
              </span>
            ))}
          </div>
        </article>

        {/* Stacked mini metrics */}
        <div className="flex min-w-0 flex-col gap-3 lg:col-span-4">
          {sideMetrics.map((m) => (
            <article key={m.label} className="surface flex flex-1 items-center gap-4 px-5 py-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-night">
                <m.icon className="h-5 w-5 text-accent" strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <dt className="eyebrow text-[10.5px]">{m.label}</dt>
                <dd className="mt-0.5 nums text-[22px] font-semibold leading-none tracking-tight">
                  {isLoading ? "—" : m.value}
                </dd>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-ink-faint" aria-hidden="true" />
            </article>
          ))}
        </div>
      </div>

      {/* Bento row 2: Full-width activity chart */}
      <article className="surface min-w-0 p-5">
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
              <span className="h-2 w-2 rounded-full bg-accent opacity-40" />
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
                      fill="#f2fb48"
                      fillOpacity="0.05"
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
                    {/* Indexed smooth line — dashed */}
                    <path
                      fill="none"
                      stroke="#f2fb48"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="6 4"
                      strokeOpacity="0.4"
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
                          r="3"
                          fill="#f2fb48"
                          fillOpacity="0.4"
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
                      <span className="h-2 w-2 rounded-full bg-accent opacity-40" />
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

      {/* Bento row 3: Library + Side panels */}
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
