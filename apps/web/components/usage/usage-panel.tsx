"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  ArrowRight,
  Key,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Zap
} from "lucide-react";
import {
  getApiKeyUsage,
  listApiKeys,
  type ApiKey,
  type ApiKeyUsage
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { useServerError } from "@/lib/server-errors";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const USAGE_DAYS = 14;

interface KeyWithUsage {
  key: ApiKey;
  usage: ApiKeyUsage | null;
}

function usageErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "failed";
}

export function UsagePanel() {
  const t = useT();
  const copy = t.usage;
  const serverError = useServerError();
  const [keysWithUsage, setKeysWithUsage] = useState<KeyWithUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setKeysWithUsage([]);
        setError("signIn");
        return;
      }

      const keys = await listApiKeys(accessToken);
      const results = await Promise.all(
        keys.map(async (key) => {
          const usage = key.revoked_at
            ? null
            : await getApiKeyUsage(accessToken, key.id, USAGE_DAYS).catch(() => null);
          return { key, usage };
        })
      );
      setKeysWithUsage(results);
    } catch (loadError) {
      setError(usageErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const aggregated = useMemo(() => {
    const dayMap = new Map<string, { date: string; allowed: number; rejected: number }>();

    for (const { usage } of keysWithUsage) {
      if (!usage?.by_day) continue;
      for (const day of usage.by_day) {
        const existing = dayMap.get(day.date);
        if (existing) {
          existing.allowed += day.allowed;
          existing.rejected += day.rejected;
        } else {
          dayMap.set(day.date, { ...day });
        }
      }
    }

    return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [keysWithUsage]);

  const chartData = useMemo(() => {
    return aggregated.map((day) => ({
      date: day.date,
      label: new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(day.date)),
      allowed: day.allowed,
      rejected: day.rejected
    }));
  }, [aggregated]);

  const totals = useMemo(() => {
    let total = 0;
    let allowed = 0;
    let rejected = 0;
    for (const day of aggregated) {
      total += day.allowed + day.rejected;
      allowed += day.allowed;
      rejected += day.rejected;
    }
    const activeKeys = keysWithUsage.filter((k) => !k.key.revoked_at).length;
    return { total, allowed, rejected, activeKeys };
  }, [aggregated, keysWithUsage]);

  const metricCards = [
    { label: copy.totalRequests, value: totals.total, icon: Zap, color: "text-accent" },
    { label: copy.allowed, value: totals.allowed, icon: ShieldCheck, color: "text-[#4f7e4d]" },
    { label: copy.rejected, value: totals.rejected, icon: ShieldX, color: "text-[#b54a4a]" },
    { label: copy.activeKeys, value: totals.activeKeys, icon: Key, color: "text-[#6b5b95]" }
  ];

  return (
    <div className="flex flex-col gap-3">
      <section className="surface flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-night shadow-root">
            <BarChart3Icon className="h-6 w-6 text-accent" strokeWidth={2} aria-hidden="true" />
          </div>
          <div>
            <span className="eyebrow">{copy.eyebrow}</span>
            <h2 className="mt-0.5 text-[18px] font-semibold tracking-tight">{copy.title}</h2>
            <p className="mt-0.5 text-[12px] text-ink-muted">{copy.subtitle}</p>
          </div>
        </div>
        <Button disabled={isLoading} onClick={() => void loadData()} variant="secondary">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {copy.refresh}
        </Button>
      </section>

      {error ? (
        <section className="rounded-card border border-danger-line bg-danger-soft px-5 py-4 text-[13.5px] text-danger">
          {copy.errors[error as keyof typeof copy.errors] ?? serverError(error)}
        </section>
      ) : null}

      {!error && !isLoading && keysWithUsage.length === 0 ? (
        <section className="surface flex flex-col items-center gap-3 px-5 py-10 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-paper-chip">
            <Key className="h-7 w-7 text-ink-muted" aria-hidden="true" />
          </div>
          <p className="text-[15px] font-semibold">{copy.noKeys}</p>
          <p className="max-w-sm text-[13px] text-ink-muted">{copy.noKeysHint}</p>
          <Link
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-control bg-night px-4 text-[13px] font-medium text-white shadow-node hover:bg-night-raised"
            href="/api-keys"
          >
            {copy.goToKeys}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      {keysWithUsage.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metricCards.map((m) => (
              <article key={m.label} className="surface flex items-center gap-4 px-5 py-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-paper-chip">
                  <m.icon className={cn("h-5 w-5", m.color)} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <dt className="eyebrow text-[10.5px]">{m.label}</dt>
                  <dd className="mt-0.5 nums text-[26px] font-semibold leading-none tracking-tight">
                    {isLoading ? "—" : m.value.toLocaleString()}
                  </dd>
                </div>
              </article>
            ))}
          </div>

          <article className="surface min-w-0 p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight">{copy.dailyBreakdown}</h3>
                <p className="mt-0.5 text-[12px] text-ink-muted">{copy.dailySubtitle}</p>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#4f7e4d]" />
                  {copy.allowed}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#b54a4a]" />
                  {copy.rejected}
                </span>
                <span className="font-medium text-ink">{copy.period(USAGE_DAYS)}</span>
              </div>
            </div>
            <div className="h-[240px] w-full">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-[13px] text-ink-muted">{copy.loading}</div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#8b8680" }}
                      interval="preserveStartEnd"
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#8b8680" }} allowDecimals={false} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="rounded-lg border border-paper-line bg-paper-card px-3 py-2 text-[12px] shadow-node">
                            <p className="mb-1 font-medium text-ink-muted">{label}</p>
                            {payload.map((entry) => (
                              <div key={entry.name} className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                                <span className="text-ink-muted">{entry.name}:</span>
                                <span className="font-semibold nums">{entry.value}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="allowed" name={t.usage.allowed} stackId="a" fill="#4f7e4d" radius={[0, 0, 0, 0]} barSize={20} />
                    <Bar dataKey="rejected" name={t.usage.rejected} stackId="a" fill="#b54a4a" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-[13px] text-ink-muted">{copy.loading}</div>
              )}
            </div>
          </article>

          <article className="surface min-w-0 p-5">
            <div className="mb-4">
              <h3 className="text-[15px] font-semibold tracking-tight">{copy.perKeyTitle}</h3>
              <p className="mt-0.5 text-[12px] text-ink-muted">{copy.perKeySubtitle}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-paper-line">
                    <th className="eyebrow px-3 py-2 font-semibold">{copy.keyName}</th>
                    <th className="eyebrow px-3 py-2 text-right font-semibold">{copy.keyRequests}</th>
                    <th className="eyebrow px-3 py-2 text-right font-semibold">{copy.keyAllowed}</th>
                    <th className="eyebrow px-3 py-2 text-right font-semibold">{copy.keyRejected}</th>
                    <th className="eyebrow px-3 py-2 font-semibold">14d trend</th>
                    <th className="eyebrow px-3 py-2 text-right font-semibold">{copy.keyLastUsed}</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td className="px-3 py-6 text-ink-muted" colSpan={6}>{copy.loading}</td>
                    </tr>
                  ) : (
                    keysWithUsage.map(({ key, usage }) => {
                      const keyTotal = usage?.total ?? 0;
                      const keyAllowed = usage?.allowed ?? 0;
                      const keyRejected = usage?.rejected ?? 0;
                      const maxDay = usage?.by_day
                        ? Math.max(...usage.by_day.map((d) => d.allowed + d.rejected), 1)
                        : 1;

                      return (
                        <tr key={key.id} className="border-b border-paper-line/60 last:border-0">
                          <td className="max-w-[200px] px-3 py-3">
                            <div className="flex items-center gap-2">
                              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-paper-chip">
                                <Key className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
                              </span>
                              <div className="min-w-0">
                                <span className="block truncate font-medium">{key.name}</span>
                                <span className="block font-mono text-[11px] text-ink-faint">
                                  {key.key_prefix}…{key.last_four}
                                  {key.revoked_at ? (
                                    <span className="ml-1.5 text-danger">({copy.revoked})</span>
                                  ) : null}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="nums px-3 py-3 text-right font-semibold">{keyTotal.toLocaleString()}</td>
                          <td className="nums px-3 py-3 text-right text-[#4f7e4d]">{keyAllowed.toLocaleString()}</td>
                          <td className="nums px-3 py-3 text-right text-[#b54a4a]">{keyRejected.toLocaleString()}</td>
                          <td className="px-3 py-3">
                            {usage?.by_day?.length ? (
                              <div className="flex items-end gap-[2px] h-[28px]">
                                {usage.by_day.map((day) => {
                                  const total = day.allowed + day.rejected;
                                  const height = Math.max(2, (total / maxDay) * 28);
                                  const rejectedRatio = total > 0 ? day.rejected / total : 0;
                                  return (
                                    <div
                                      key={day.date}
                                      className="w-[6px] rounded-t-sm"
                                      style={{
                                        height: `${height}px`,
                                        background: rejectedRatio > 0.5
                                          ? `linear-gradient(to top, #b54a4a, #b54a4a ${rejectedRatio * 100}%, #4f7e4d ${rejectedRatio * 100}%)`
                                          : `linear-gradient(to top, #4f7e4d, #4f7e4d ${(1 - rejectedRatio) * 100}%, #b54a4a ${(1 - rejectedRatio) * 100}%)`
                                      }}
                                      title={`${day.date}: ${total} requests`}
                                    />
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-[12px] text-ink-faint">—</span>
                            )}
                          </td>
                          <td className="nums px-3 py-3 text-right text-[12.5px] text-ink-muted">
                            {key.last_used_at
                              ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(key.last_used_at))
                              : copy.never}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </>
      ) : null}
    </div>
  );
}

function BarChart3Icon(props: React.SVGProps<SVGSVGElement> & { strokeWidth?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={props.strokeWidth ?? 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 3v18h18" />
      <rect x="7" y="13" width="3" height="5" rx="0.5" />
      <rect x="12" y="8" width="3" height="10" rx="0.5" />
      <rect x="17" y="5" width="3" height="13" rx="0.5" />
    </svg>
  );
}
