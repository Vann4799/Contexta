"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FileInput, Layers, Minus, Plus, RotateCcw, Waypoints, type LucideIcon } from "lucide-react";
import type { PipelineCluster, PipelineClusterId, PipelineRoot } from "@/lib/pipeline";
import { OVERFLOW_LEAF_ID } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

const CLUSTER_ICONS: Record<PipelineClusterId, LucideIcon> = {
  indexed: Layers,
  queue: FileInput,
  failed: AlertTriangle
};

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.3;

type Point = { x: number; y: number };
type Edge = { id: string; d: string; kind: "trunk" | "branch"; cluster: string; end: Point };

/** Smooth horizontal S-curve between two points. */
function curve(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.max(24, (x2 - x1) * 0.55);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

function leftAnchor(rect: DOMRect, box: DOMRect, k: number) {
  return { x: (rect.left - box.left) / k, y: (rect.top + rect.height / 2 - box.top) / k };
}

function rightAnchor(rect: DOMRect, box: DOMRect, k: number) {
  return { x: (rect.right - box.left) / k, y: (rect.top + rect.height / 2 - box.top) / k };
}

type SynapseGraphProps = {
  root: PipelineRoot;
  clusters: PipelineCluster[];
};

export function SynapseGraph({ root, clusters }: SynapseGraphProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const clusterRefs = useRef(new Map<string, HTMLElement>());
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

  const [edges, setEdges] = useState<Edge[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const nodeCount =
    1 +
    clusters.length +
    clusters.reduce(
      (count, cluster) => count + cluster.items.filter((item) => item.id !== OVERFLOW_LEAF_ID).length,
      0
    );

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
    const rr = rootNode.getBoundingClientRect();
    const rootOut = rightAnchor(rr, box, k);
    const next: Edge[] = [];

    for (const cluster of clusters) {
      const cell = clusterRefs.current.get(cluster.id);
      if (!cell) {
        continue;
      }
      const clusterRect = cell.getBoundingClientRect();
      const clusterIn = leftAnchor(clusterRect, box, k);
      const clusterOut = rightAnchor(clusterRect, box, k);
      next.push({
        id: `root-${cluster.id}`,
        d: curve(rootOut.x, rootOut.y, clusterIn.x, clusterIn.y),
        kind: "trunk",
        cluster: cluster.id,
        end: clusterIn
      });

      // One branch per document leaf hanging off the cluster card.
      const leaves = stage.querySelectorAll<HTMLElement>(`[data-cluster="${cluster.id}"] [data-leaf]`);
      leaves.forEach((leaf) => {
        const leafIn = leftAnchor(leaf.getBoundingClientRect(), box, k);
        next.push({
          id: `${cluster.id}-${leaf.dataset.leaf}`,
          d: curve(clusterOut.x, clusterOut.y, leafIn.x, leafIn.y),
          kind: "branch",
          cluster: cluster.id,
          end: leafIn
        });
      });
    }

    setSize({ w: box.width / k, h: box.height / k });
    setEdges((current) => {
      const signature = next.map((edge) => `${edge.id}:${edge.d}`).join("|");
      if (current.length === next.length && current.map((edge) => `${edge.id}:${edge.d}`).join("|") === signature) {
        return current;
      }
      return next;
    });
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
    setPan({ x: 0, y: 0 });
  }, [clusters.length]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") {
      return;
    }
    if ((event.target as HTMLElement).closest("a,button")) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    setPan({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY)
    });
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

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
          <span className="hidden sm:inline">Live Synapse Graph</span>
        </span>
        <span className="mx-1 h-5 w-px bg-paper-line" />
        <ToolButton label="Zoom out" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.1).toFixed(2)))}>
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolButton>
        <ToolButton label="Zoom in" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.1).toFixed(2)))}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolButton>
        <button
          className="focus-ring ml-1 inline-flex h-7 items-center gap-1 rounded-control bg-paper-chip px-2 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
          type="button"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" /> Reset
        </button>
        <span className="nums px-2.5 font-mono text-[12.5px] font-medium text-ink">Nodes: {nodeCount}</span>
      </div>

      <div
        className={cn(
          "relative lg:max-h-[540px] lg:select-none lg:overflow-hidden",
          isPanning ? "cursor-grabbing" : "lg:cursor-grab"
        )}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          ref={stageRef}
          className="relative px-5 pb-12 pt-24 lg:min-w-[1180px] lg:px-14 lg:pb-12 lg:pt-[112px]"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: "top center",
            transition: isPanning ? "none" : "transform 300ms ease"
          }}
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
                  <g
                    className={cn("transition-opacity duration-200", dim && "opacity-35")}
                    key={edge.id}
                  >
                    <path
                      className={cn(
                        "transition-[stroke] duration-200",
                        hover === edge.cluster ? "stroke-ink" : "stroke-paper-edge"
                      )}
                      d={edge.d}
                      fill="none"
                      strokeWidth={1.25}
                    />
                    <circle
                      className={cn(hover === edge.cluster ? "fill-ink" : "fill-paper-edge")}
                      cx={edge.end.x}
                      cy={edge.end.y}
                      r={2.5}
                    />
                  </g>
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
                  data-cluster={cluster.id}
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
                      <li data-leaf={item.id} key={item.id}>
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

      <p className="pointer-events-none absolute bottom-3 right-4 z-20 hidden font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint lg:block">
        drag to pan - click a node to open
      </p>
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
        <span className="rounded bg-night-raised px-1.5 py-0.5 font-mono text-[10px] text-white/70">{root.engine}</span>
      </div>
      <div className="mt-5 text-[14px] font-semibold">{root.name}</div>
      <div className="nums mt-0.5 font-mono text-[13px] text-white/90">{root.primary}</div>
      <div className="mt-0.5 truncate font-mono text-[11px] text-white/55">{root.collection}</div>
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
  const isOverflow = item.id === OVERFLOW_LEAF_ID;
  return (
    <Link
      className={cn(
        "focus-ring group inline-flex max-w-full items-center gap-2.5 rounded-control border py-1 pl-3 pr-1 text-left shadow-node transition hover:border-ink/30",
        isOverflow
          ? "border-dashed border-paper-edge bg-paper-soft text-ink-muted"
          : "border-paper-line bg-paper-card"
      )}
      href={item.href}
    >
      {item.dot ? <span className="h-2 w-2 shrink-0 rounded-full bg-accent ring-1 ring-ink/70" aria-hidden="true" /> : null}
      <span className={cn("truncate font-mono text-[12px] font-medium", isOverflow ? "text-ink-muted" : "text-ink")}>{item.name}</span>
      {item.meta ? <span className="shrink-0 font-mono text-[11.5px] text-ink-muted">{item.meta}</span> : null}
      {item.tag ? (
        <span className="shrink-0 rounded-control bg-paper-chip px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-ink">{item.tag}</span>
      ) : (
        <span className="w-1" />
      )}
    </Link>
  );
}
