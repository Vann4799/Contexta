"use client";

import { useMemo } from "react";
import { Waypoints } from "lucide-react";
import type { IndexingHealth } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { sampleMetrics, viewTabs, type PipelineMetric, type PipelineRoot } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

type IndexHeaderProps = {
  metrics: PipelineMetric[];
  root: PipelineRoot;
  health: IndexingHealth | null;
  activeTab: string;
  isLoading: boolean;
  onTabChange: (tab: string) => void;
};

export function IndexHeader({ metrics, root, health, activeTab, isLoading, onTabChange }: IndexHeaderProps) {
  const t = useT();
  const copy = t.pipeline;
  const tabs = useMemo(() => viewTabs(copy), [copy]);
  const samples = useMemo(() => sampleMetrics(copy), [copy]);
  const attention = health?.status === "attention";

  return (
    <section className="surface flex flex-col gap-7 px-5 py-6 lg:flex-row lg:items-start lg:gap-9 lg:px-7">
      <div className="flex shrink-0 items-center gap-4 lg:w-[340px]">
        <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-card bg-night shadow-root">
          <Waypoints className="h-7 w-7 text-accent" strokeWidth={2.2} aria-hidden="true" />
          <span
            aria-hidden="true"
            className={cn(
              "absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white",
              attention ? "bg-danger" : "animate-pulse-dot bg-accent"
            )}
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="eyebrow">{copy.embeddingEyebrow}</span>
            <span className="rounded bg-accent px-1.5 py-[1px] text-[10px] font-bold tracking-[0.08em] text-ink">
              {attention ? copy.badgeAttention : copy.badgeSynced}
            </span>
          </div>
          <h1 className="mt-1 truncate text-[22px] font-semibold leading-tight tracking-tight">{root.models || copy.indexUnknown}</h1>
          <p className="mt-0.5 truncate font-mono text-[12px] text-ink-muted">
            {root.collection && root.shape ? copy.collectionLine(root.collection, root.shape) : copy.collectionUnknown}
          </p>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 xl:grid-cols-5">
          {metrics.map((stat) => (
            <div key={stat.label}>
              <dt className="eyebrow">{stat.label}</dt>
              <dd className="mt-1 flex items-baseline gap-1">
                <span className="nums text-[30px] font-semibold leading-none tracking-tight">{isLoading ? "—" : stat.value}</span>
                <span className="text-[13px] font-medium text-ink-muted">{stat.unit}</span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-2" aria-label={copy.viewsLabel} role="tablist">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                aria-selected={active}
                className={cn(
                  "focus-ring inline-flex h-7 items-center gap-1.5 rounded-control border px-2.5 text-[12.5px] font-medium transition",
                  active
                    ? "border-paper-line bg-paper-card text-ink shadow-node"
                    : "border-transparent bg-paper-chip text-ink-muted hover:text-ink"
                )}
                key={tab.id}
                role="tab"
                type="button"
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-control border border-dashed border-paper-edge px-4 py-3">
          <p className="eyebrow">{copy.sampleEyebrow}</p>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            {samples.map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-1.5">
                <dt className="text-[11.5px] text-ink-muted">{stat.label}</dt>
                <dd className="nums text-[13px] font-semibold text-ink-muted">
                  {stat.value}
                  <span className="ml-1 font-normal">{stat.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
