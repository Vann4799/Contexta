"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FileInput, Layers, Minus, Plus, RotateCcw, Waypoints, type LucideIcon } from "lucide-react";
import type { PipelineCluster, PipelineClusterId, PipelineRoot } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

const CLUSTER_ICONS: Record<PipelineClusterId, LucideIcon> = {
  indexed: Layers,
  queue: FileInput,
  failed: AlertTriangle
};

type Edge = { id: string; d: string; kind: "trunk" | "branch"; cluster: string };

/** Smooth horizontal S-curve between two points. */
function curve(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.max(24, (x2 - x1) * 0.55);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

type SynapseGraphProps = {
  root: PipelineRoot;
  clusters: PipelineCluster[];
};

export function SynapseGraph({ root, clusters }: SynapseGraphProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const clusterRefs = useRef(new Map<string, HTMLElement>());

  const [edges, setEdges] = useState<Edge[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const nodeCount = 1 + clusters.length + clusters.reduce((count, cluster) => count + cluster.items.length, 0);

  const measure = useCallback(() => {
    const stage = stageRef.current;
    const rootNode = rootRef.current;
    if (!stage || !rootNode) {
      return;
    }
    // Connectors only make sense in the wide (row) layout.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setEdges([]);
      return;
    }
    const box = stage.getBoundingClientRect();
    const k = zoom || 1;
    const rel = (rect: DOMRect) => ({
      l: (rect.left - box.left) / k,
      r: (rect.right - box.left) / k,
      cy: (rect.top + rect.height / 2 - box.top) / k
    });

    const rr = rel(rootNode.getBoundingClientRect());
    const next: Edge[] = [];
    for (const cluster of clusters) {
      const cell = clusterRefs.current.get(cluster.id);
      if (!cell) {
        continue;
      }
      const cr = rel(cell.getBoundingClientRect());
      next.push({ id: `root-${cluster.id}`, d: curve(rr.r, rr.cy, cr.l, cr.cy), kind: "trunk", cluster: cluster.id });
    }
    setSize({ w: box.width / k, h: box.height / k });
    setEdges(next);
  }, [clusters, zoom]);

  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (stageRef.current) {
      observer.observe(stageRef.current);
    }
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  useEffect(() => {
    setZoom(1);
  }, [clusters.length]);

  return (
    <section
      aria-label="Live synapse graph"
      className="relative overflow-hidden rounded-card border border-paper-line bg-paper-deep"
      style={{
        backgroundImage: "linear-gradient(to right, rgb(19 19 21 / 0.05) 1px, transparent 1px)",
        backgroundSize: "80px 100%"
      }}
    >
      <div className="absolute left-5 top-5 z-20 flex items-center gap-1 rounded-card border border-paper-line bg-paper-card p-1 shadow-node lg:left-12 lg:top-11">
        <span className="flex items-center gap-2 px-2.5 text-[13px] text-ink-muted">
          <Waypoints className="h-4 w-4 text-ink" aria-hidden="true" />
          Live Synapse Graph
        </span>
        <span className="mx-1 h-5 w-px bg-paper-line" />
        <ToolButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(2)))}>
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolButton>
        <ToolButton label="Zoom in" onClick={() => setZoom((z) => Math.min(1.3, +(z + 0.1).toFixed(2)))}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolButton>
        <button
          className="focus-ring ml-1 inline-flex h-7 items-center gap-1 rounded-control bg-paper-chip px-2 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
          type="button"
          onClick={() => setZoom(1)}
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" /> Reset
        </button>
        <span className="nums px-2.5 font-mono text-[12.5px] font-medium text-ink">Nodes: {nodeCount}</span>
      </div>

      <div className="overflow-x-auto">
        <div
          ref={stageRef}
          className="relative mx-auto origin-top-left px-5 pb-12 pt-24 transition-transform duration-300 lg:min-w-[1180px] lg:px-14 lg:pb-12 lg:pt-[76px]"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
          onTransitionEnd={measure}
        >
          {size.w > 0 ? (
            <svg
              aria-hidden
              className="pointer-events-none absolute inset-0 hidden lg:block"
              width={size.w}
              height={size.h}
              viewBox={`0 0 ${size.w} ${size.h}`}
            >
              {edges.map((edge) => {
                const dim = hover !== null && hover !== edge.cluster;
                if (edge.kind === "trunk") {
                  return (
                    <g key={edge.id} className="transition-opacity duration-200" opacity={dim ? 0.3 : 1}>
                      <path className="stroke-ink" d={edge.d} fill="none" strokeOpacity={0.12} strokeWidth={4} />
                      <path className="stroke-accent" d={edge.d} fill="none" strokeWidth={2.25} strokeLinecap="round" />
                      <path
                        className="animate-dash stroke-ink"
                        d={edge.d}
                        fill="none"
                        strokeOpacity={0.35}
                        strokeDasharray="2 10"
                        strokeWidth={1.25}
                      />
                    </g>
                  );
                }
                return (
                  <path
                    className={cn("transition-[stroke,opacity] duration-200", hover === edge.cluster ? "stroke-ink" : "stroke-paper-edge")}
                    d={edge.d}
                    fill="none"
                    key={edge.id}
                    opacity={dim ? 0.35 : 1}
                    strokeWidth={1.25}
                  />
                );
              })}
            </svg>
          ) : null}

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-[84px]">
            <div className="shrink-0 lg:w-[228px]" ref={rootRef}>
              <RootCard root={root} />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-8">
              {clusters.length === 0 ? (
                <p className="text-[13px] text-ink-muted">No nodes in this view - pick another tab or upload a document.</p>
              ) : null}
              {clusters.map((cluster) => (
                <div
                  className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-[52px]"
                  key={cluster.id}
                  onMouseEnter={() => setHover(cluster.id)}
                  onMouseLeave={() => setHover(null)}
                >
                  <ClusterCard
                    cluster={cluster}
                    active={hover === cluster.id}
                    ref={(el) => {
                      if (el) {
                        clusterRefs.current.set(cluster.id, el);
                      } else {
                        clusterRefs.current.delete(cluster.id);
                      }
                    }}
                  />
                  <ul className="flex min-w-0 flex-col gap-2.5 pl-4 lg:pl-0">
                    {cluster.items.map((item) => (
                      <li key={item.id}>
                        <LeafRow item={item} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      className="focus-ring grid h-7 w-7 place-items-center rounded-control text-ink transition-colors hover:bg-paper-chip"
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function RootCard({ root }: { root: PipelineRoot }) {
  return (
    <div className="rounded-card bg-night p-4 text-white shadow-root ring-1 ring-black/40">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" aria-hidden="true" />
          Knowledge Root
        </span>
        <span className="rounded bg-night-raised px-1.5 py-0.5 font-mono text-[10px] text-white/70">{root.collection}</span>
      </div>
      <div className="mt-5 text-[14px] font-semibold">{root.name}</div>
      <div className="nums mt-0.5 font-mono text-[13px] text-white/90">{root.primary}</div>
      <div className="my-4 h-px bg-night-line" />
      <dl className="grid grid-cols-2 gap-2">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">Clusters</dt>
          <dd className="mt-0.5 text-[14px] font-semibold">{root.clusters}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">Documents</dt>
          <dd className="nums mt-0.5 font-mono text-[14px] font-semibold">{root.files}</dd>
        </div>
      </dl>
    </div>
  );
}

type ClusterCardProps = {
  cluster: PipelineCluster;
  active: boolean;
  ref?: (el: HTMLDivElement | null) => void;
};

function ClusterCard({ cluster, active, ref }: ClusterCardProps) {
  const Icon = CLUSTER_ICONS[cluster.id];
  return (
    <div
      className={cn(
        "flex w-full shrink-0 items-center gap-3 rounded-card border bg-paper-card px-3 py-2.5 shadow-node transition lg:w-[252px]",
        active ? "-translate-y-px border-ink/40" : "border-paper-line"
      )}
      ref={ref}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-paper-chip text-ink">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="whitespace-nowrap text-[13px] font-semibold leading-tight">{cluster.title}</span>
          {cluster.badge ? (
            <span
              className={cn(
                "whitespace-nowrap rounded px-1.5 py-[1px] text-[10px] font-semibold",
                cluster.badge.tone === "lime" && "bg-accent text-ink",
                cluster.badge.tone === "dark" && "bg-night text-white"
              )}
            >
              {cluster.badge.label}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-ink-muted">{cluster.subtitle}</div>
      </div>
    </div>
  );
}

function LeafRow({ item }: { item: PipelineCluster["items"][number] }) {
  return (
    <Link
      className="focus-ring group inline-flex max-w-full items-center gap-2.5 rounded-control border border-paper-line bg-paper-card py-1 pl-3 pr-1 text-left shadow-node transition hover:border-ink/30"
      href={item.href}
    >
      {item.dot ? <span className="h-2 w-2 shrink-0 rounded-full bg-accent ring-1 ring-ink/70" aria-hidden="true" /> : null}
      <span className="truncate font-mono text-[12px] font-medium text-ink">{item.name}</span>
      {item.meta ? <span className="shrink-0 font-mono text-[11.5px] text-ink-muted">{item.meta}</span> : null}
      {item.tag ? (
        <span className="shrink-0 rounded-control bg-paper-chip px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-ink">{item.tag}</span>
      ) : (
        <span className="w-1" />
      )}
    </Link>
  );
}
