"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CreditCard,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { BillingStatus, Plan, PlanTier } from "@/lib/api";
import { getBillingPlans, getBillingStatus, getBillingCheckoutUrl } from "@/lib/api";
import { useT } from "@/lib/i18n";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function UsageBar({
  label,
  used,
  max,
  overLimit,
  formatValue,
}: {
  label: string;
  used: number;
  max: number;
  overLimit: boolean;
  formatValue: (used: number, max: number) => string;
}) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const isHigh = pct >= 80;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-ink-muted">
            {formatValue(used, max)}
          </span>
          {overLimit ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
              <AlertTriangle className="h-3 w-3" strokeWidth={2} />
              Over
            </span>
          ) : null}
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-muted/10">
        <div
          className={`h-full rounded-full transition-all ${
            overLimit
              ? "bg-amber-500"
              : isHigh
                ? "bg-amber-400"
                : "bg-amber-300"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  isCurrent,
  onSelect,
}: {
  plan: Plan;
  isCurrent: boolean;
  onSelect: (plan: Plan) => void;
}) {
  const t = useT();
  const isFree = plan.tier === "free";
  const isEnterprise = plan.tier === "enterprise";

  return (
    <div
      className={`surface flex flex-col rounded-2xl border p-5 transition-colors ${
        isCurrent ? "border-amber-400 ring-1 ring-amber-400/30" : "border-ink-border"
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            {plan.name}
          </p>
          <p className="mt-1 text-[24px] font-semibold text-ink">
            {t.billing.priceMonthly(plan.price_monthly)}
          </p>
          {!isFree ? (
            <p className="text-[11px] text-ink-muted">
              {t.billing.priceYearly(plan.price_yearly)}{t.billing.perYear}
            </p>
          ) : null}
        </div>
        {isCurrent ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            {t.billing.current}
          </span>
        ) : null}
      </div>

      <ul className="mb-5 flex-1 space-y-2">
        <li className="flex items-center gap-2 text-[12px] text-ink">
          <Check className="h-3.5 w-3.5 shrink-0 text-amber-500" strokeWidth={2} />
          {t.billing.limitDocuments(plan.limits.max_documents)}
        </li>
        <li className="flex items-center gap-2 text-[12px] text-ink">
          <Check className="h-3.5 w-3.5 shrink-0 text-amber-500" strokeWidth={2} />
          {t.billing.limitStorage(plan.limits.max_storage_bytes)}
        </li>
        <li className="flex items-center gap-2 text-[12px] text-ink">
          <Check className="h-3.5 w-3.5 shrink-0 text-amber-500" strokeWidth={2} />
          {t.billing.limitApiKeys(plan.limits.max_api_keys)}
        </li>
        <li className="flex items-center gap-2 text-[12px] text-ink">
          <Check className="h-3.5 w-3.5 shrink-0 text-amber-500" strokeWidth={2} />
          {t.billing.limitApiRequests(plan.limits.max_api_requests_per_day)}
        </li>
        <li className="flex items-center gap-2 text-[12px] text-ink">
          <Check className="h-3.5 w-3.5 shrink-0 text-amber-500" strokeWidth={2} />
          {t.billing.limitChatMessages(plan.limits.max_chat_messages_per_day)}
        </li>
      </ul>

      <button
        type="button"
        onClick={() => onSelect(plan)}
        disabled={isCurrent}
        className={`focus-ring w-full rounded-control px-3 py-2 text-[13px] font-medium transition-colors ${
          isCurrent
            ? "cursor-default border border-ink-border bg-paper-soft text-ink-muted"
            : isFree
              ? "border border-ink-border text-ink hover:bg-paper-soft"
              : isEnterprise
                ? "bg-ink text-paper hover:bg-ink/90"
                : "bg-accent text-night hover:bg-accent/90"
        }`}
      >
        {isCurrent ? t.billing.current : isFree ? t.billing.downgrade : t.billing.upgrade}
      </button>
    </div>
  );
}

export function BillingPanel() {
  const t = useT();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError(t.billing.errors.signIn);
        return;
      }
      const [status, planList] = await Promise.all([
        getBillingStatus(token),
        getBillingPlans(),
      ]);
      setBilling(status);
      setPlans(planList);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.billing.errors.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, t.billing.errors.signIn, t.billing.errors.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePlanSelect = async (plan: Plan) => {
    if (plan.tier === "free") return;
    try {
      const token = await getAccessToken();
      if (!token) return;
      const checkoutUrl = await getBillingCheckoutUrl(token, plan.tier, "monthly");
      window.location.href = checkoutUrl;
    } catch {
      setError(t.billing.errors.loadFailed);
    }
  };

  if (loading && !billing) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-ink-muted" strokeWidth={2} />
      </div>
    );
  }

  if (error && !billing) {
    return (
      <div className="surface p-6">
        <div className="rounded-control border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-[13px] text-amber-900">{error}</p>
        </div>
      </div>
    );
  }

  if (!billing) return null;

  const tierOrder: PlanTier[] = ["free", "pro", "enterprise"];
  const sortedPlans = [...plans].sort(
    (a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)
  );

  const anyOverage = Object.values(billing.overages).some(Boolean);

  return (
    <div className="space-y-4">
      <section className="surface p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="eyebrow">{t.billing.eyebrow}</p>
            <h2 className="mt-1 text-[22px] font-semibold text-ink">{t.billing.title}</h2>
            <p className="mt-1 text-[13px] text-ink-muted">{t.billing.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="focus-ring flex items-center gap-2 rounded-control border border-ink-border px-3 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-paper-soft hover:text-ink disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
            {t.billing.refresh}
          </button>
        </div>

        {anyOverage ? (
          <div className="mb-5 flex items-center gap-3 rounded-control border border-amber-300 bg-amber-50 p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} />
            <p className="text-[12px] text-amber-900">
              {t.billing.overLimit} — upgrade your plan to increase limits.
            </p>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-ink-muted" strokeWidth={2} />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                {t.billing.currentPlan}
              </p>
            </div>

            <div className="rounded-control border border-ink-border p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100">
                  {billing.plan.tier === "enterprise" ? (
                    <Sparkles className="h-5 w-5 text-amber-700" strokeWidth={2} />
                  ) : (
                    <Zap className="h-5 w-5 text-amber-600" strokeWidth={2} />
                  )}
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-ink">{billing.plan.name}</p>
                  <p className="text-[12px] text-ink-muted">
                    {t.billing.priceMonthly(billing.plan.price_monthly)}
                  </p>
                </div>
              </div>

              {billing.subscription ? (
                <div className="mt-4 space-y-2 border-t border-ink-border pt-3">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-ink-muted">{t.billing.subscriptionStatus}</span>
                    <span className="font-medium capitalize text-ink">{billing.subscription.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-ink-muted">{t.billing.periodStart}</span>
                    <span className="text-ink">{formatDate(billing.subscription.current_period_start)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-ink-muted">{t.billing.periodEnd}</span>
                    <span className="text-ink">{formatDate(billing.subscription.current_period_end)}</span>
                  </div>
                  {billing.subscription.cancel_at_period_end ? (
                    <p className="text-[11px] text-amber-700">{t.billing.cancelAtPeriodEnd}</p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-[12px] text-ink-muted">{t.billing.noSubscription}</p>
              )}
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-ink-muted" strokeWidth={2} />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  {t.billing.usageTitle}
                </p>
                <p className="text-[11px] text-ink-muted">{t.billing.usageSubtitle}</p>
              </div>
            </div>

            <div className="space-y-4 rounded-control border border-ink-border p-4">
              <UsageBar
                label={t.billing.documents}
                used={billing.usage.documents_count}
                max={billing.plan.limits.max_documents}
                overLimit={billing.overages.documents}
                formatValue={(u, m) => t.billing.ofLimit(u, m)}
              />
              <UsageBar
                label={t.billing.storage}
                used={billing.usage.storage_bytes}
                max={billing.plan.limits.max_storage_bytes}
                overLimit={billing.overages.storage}
                formatValue={(u, m) => `${formatBytes(u)} / ${formatBytes(m)}`}
              />
              <UsageBar
                label={t.billing.apiKeys}
                used={billing.usage.api_keys_count}
                max={billing.plan.limits.max_api_keys}
                overLimit={billing.overages.api_keys}
                formatValue={(u, m) => t.billing.ofLimit(u, m)}
              />
              <UsageBar
                label={t.billing.apiRequests}
                used={billing.usage.api_requests_today}
                max={billing.plan.limits.max_api_requests_per_day}
                overLimit={billing.overages.api_requests}
                formatValue={(u, m) => t.billing.ofLimit(u, m)}
              />
              <UsageBar
                label={t.billing.chatMessages}
                used={billing.usage.chat_messages_today}
                max={billing.plan.limits.max_chat_messages_per_day}
                overLimit={billing.overages.chat_messages}
                formatValue={(u, m) => t.billing.ofLimit(u, m)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="surface p-6">
        <div className="mb-5">
          <h3 className="text-[16px] font-semibold text-ink">{t.billing.plansTitle}</h3>
          <p className="text-[12px] text-ink-muted">{t.billing.plansSubtitle}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedPlans.map((plan) => (
            <PlanCard
              key={plan.tier}
              plan={plan}
              isCurrent={plan.tier === billing.plan.tier}
              onSelect={handlePlanSelect}
            />
          ))}
        </div>

        <p className="mt-4 text-center text-[11px] text-ink-muted">{t.billing.comingSoon}</p>
      </section>
    </div>
  );
}
