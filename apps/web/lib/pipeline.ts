import type { DocumentItem, IndexingHealth } from "@/lib/api";
import { formatBytes } from "@/lib/utils";

export type PipelineClusterId = "indexed" | "queue" | "failed";

export type PipelineLeaf = {
  id: string;
  name: string;
  meta?: string;
  tag?: string;
  dot?: boolean;
  href: string;
};

export type PipelineCluster = {
  id: PipelineClusterId;
  title: string;
  subtitle: string;
  badge?: { label: string; tone: "lime" | "dark" };
  items: PipelineLeaf[];
};

export type PipelineMetric = { label: string; value: string; unit: string };

export type PipelineRoot = {
  name: string;
  engine: string;
  collection: string;
  primary: string;
  clusters: string;
  files: string;
};

export type PipelineSnapshot = {
  metrics: PipelineMetric[];
  root: PipelineRoot;
  clusters: PipelineCluster[];
  events: number[];
  ingestedChunks: string;
};

export const VIEW_TABS: { id: "all" | PipelineClusterId; label: string }[] = [
  { id: "all", label: "All nodes" },
  { id: "indexed", label: "Indexed chunks" },
  { id: "queue", label: "Ingestion queue" },
  { id: "failed", label: "Failed jobs" }
];

export type TimelineRange = { id: string; label: string; hours: number };

export const TIMELINE_RANGES: TimelineRange[] = [
  { id: "24h", label: "Past 24 Hours", hours: 24 },
  { id: "7d", label: "Past 7 Days", hours: 24 * 7 },
  { id: "30d", label: "Past 30 Days", hours: 24 * 30 }
];

/** Headline numbers the API does not measure yet - rendered as labelled samples. */
export const SAMPLE_METRICS: PipelineMetric[] = [
  { label: "Query Latency", value: "142", unit: "ms" },
  { label: "Retrieval Score", value: "0.94", unit: "cos" },
  { label: "Hit Rate", value: "99.2", unit: "%" },
  { label: "Cache Ratio", value: "68.4", unit: "%" }
];

const LEAF_LIMIT = 3;

function countFormat(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function plural(value: number, word: string) {
  return `${countFormat(value)} ${word}${value === 1 ? "" : "s"}`;
}

function relativeTime(value: string, now: number) {
  const minutes = Math.max(0, Math.round((now - new Date(value).getTime()) / 60000));
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.round(hours / 24)}d ago`;
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}...` : value;
}

export function buildPipelineSnapshot(
  documents: DocumentItem[],
  health: IndexingHealth | null,
  rangeHours: number,
  now = Date.now()
): PipelineSnapshot {
  const readyDocuments = documents.filter((document) => document.status === "ready");
  const queuedDocuments = documents.filter((document) => document.status === "uploaded");
  const processingDocuments = documents.filter((document) => document.status === "processing");
  const failedDocuments = documents.filter((document) => document.status === "failed");
  const totalChunks = documents.reduce((sum, document) => sum + document.chunk_count, 0);
  const totalStorage = documents.reduce((sum, document) => sum + document.file_size, 0);
  const queueDepth = health?.queued_documents ?? queuedDocuments.length;

  const byRecent = (a: DocumentItem, b: DocumentItem) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();

  const clusters: PipelineCluster[] = [];

  if (readyDocuments.length > 0) {
    clusters.push({
      id: "indexed",
      title: "Indexed Chunks",
      subtitle: `${plural(totalChunks, "chunk")} in Qdrant`,
      badge: { label: "Ready", tone: "lime" },
      items: [...readyDocuments].sort(byRecent).slice(0, LEAF_LIMIT).map((document) => ({
        id: document.id,
        name: truncate(document.filename, 34),
        meta: `[${countFormat(document.chunk_count)} tok]`,
        tag: document.file_type.toUpperCase(),
        href: `/documents/${document.id}`
      }))
    });
  }

  if (queuedDocuments.length + processingDocuments.length > 0) {
    clusters.push({
      id: "queue",
      title: "Ingestion Queue",
      subtitle: `${queueDepth} queued - ${processingDocuments.length} processing`,
      badge: { label: "Live", tone: "dark" },
      items: [...queuedDocuments, ...processingDocuments].sort(byRecent).slice(0, LEAF_LIMIT).map((document) => ({
        id: document.id,
        name: truncate(document.filename, 34),
        meta: relativeTime(document.updated_at, now),
        tag: document.status === "uploaded" ? "QUEUED" : "WORKING",
        dot: document.status === "processing",
        href: `/documents/${document.id}`
      }))
    });
  }

  if (failedDocuments.length > 0) {
    clusters.push({
      id: "failed",
      title: "Failed Jobs",
      subtitle: `${failedDocuments.length} document${failedDocuments.length === 1 ? "" : "s"} need a retry`,
      items: failedDocuments.sort(byRecent).slice(0, LEAF_LIMIT).map((document) => ({
        id: document.id,
        name: truncate(document.filename, 34),
        meta: truncate(document.error_message ?? "Worker error", 28),
        tag: "RETRY",
        href: `/documents/${document.id}`
      }))
    });
  }

  const windowStart = now - rangeHours * 60 * 60 * 1000;
  const events = documents
    .map((document) => new Date(document.created_at).getTime())
    .filter((timestamp) => timestamp >= windowStart && timestamp <= now)
    .map((timestamp) => Math.min(1, Math.max(0, (timestamp - windowStart) / (now - windowStart))))
    .sort((a, b) => a - b);

  return {
    metrics: [
      { label: "Documents", value: countFormat(documents.length), unit: "files" },
      { label: "Ready", value: countFormat(readyDocuments.length), unit: "indexed" },
      { label: "In queue", value: countFormat(queueDepth + processingDocuments.length), unit: "pending" },
      { label: "Chunks", value: countFormat(totalChunks), unit: "vectors" },
      { label: "Storage", value: formatBytes(totalStorage).split(" ")[0], unit: formatBytes(totalStorage).split(" ")[1] }
    ],
    root: {
      name: "Contexta Workspace",
      engine: "Qdrant",
      collection: "contexta_chunks",
      primary: plural(totalChunks, "chunk"),
      clusters: `${clusters.length} active`,
      files: countFormat(documents.length)
    },
    clusters,
    events,
    ingestedChunks: plural(totalChunks, "chunk")
  };
}
