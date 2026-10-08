import type { DocumentItem, IndexingHealth, VectorHealth } from "@/lib/api";
import type { Dictionary } from "@/locales/en";
import { formatBytes } from "@/lib/utils";

export type PipelineCopy = Dictionary["pipeline"];

export type PipelineClusterId = "indexed" | "queue" | "failed";

export type PipelineLeaf = {
  id: string;
  name: string;
  meta?: string;
  tag?: string;
  dot?: boolean;
  href: string;
  /** Real chunk count from the API - drives how deep this node can fan out. */
  chunkCount?: number;
};

/** Chunk positions drawn under one document; the rest collapse into a `+N` node. */
const CHUNK_FAN_LIMIT = 3;

export type ChunkNode = { key: string; label: string; collapsed: boolean };

/**
 * Chunks are addressed by index server-side, so the drawn positions are real
 * addresses - not text previews.
 */
export function chunkFan(documentId: string, chunkCount: number, locale = "en"): ChunkNode[] {
  const drawn = Math.min(chunkCount, CHUNK_FAN_LIMIT);
  const nodes: ChunkNode[] = Array.from({ length: drawn }, (_, index) => ({
    key: `${documentId}-chunk-${index}`,
    label: `#${index}`,
    collapsed: false
  }));
  const rest = chunkCount - drawn;
  if (rest > 0) {
    nodes.push({ key: `${documentId}-chunk-rest`, label: `+${countFormat(rest, locale)}`, collapsed: true });
  }
  return nodes;
}

/**
 * The index identity printed on /pipeline comes from `/health/vector`, never from a
 * constant here: the old hard-coded `contexta_chunks - 384d` outlived two reindexes
 * and kept describing a collection production no longer uses.
 */
export type PipelineIndexInfo = { collection: string; models: string; shape: string; arms: number };

export function describeIndex(vector: VectorHealth | null): PipelineIndexInfo {
  const collection = vector?.status === "ok" ? vector.collection || "" : "";
  if (!collection) {
    return { collection: "", models: "", shape: "", arms: 0 };
  }

  const spaces = vector?.vector_spaces ?? [];

  return {
    collection,
    models: spaces.map((space) => space.model.split("/").pop() || space.model).join(" + "),
    shape: spaces.map((space) => `${space.name ? `${space.name} ` : ""}${space.dimensions}d`).join(" + "),
    arms: spaces.length
  };
}

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
  /** Short model labels of the active arms, joined - empty when the API reports none. */
  models: string;
  /** Vector slot sizes, e.g. "minilm 384d + openai 1536d". */
  shape: string;
  /** Number of vector slots - one point per chunk per slot. */
  arms: number;
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

export function viewTabs(copy: PipelineCopy): { id: "all" | PipelineClusterId; label: string }[] {
  return [
    { id: "all", label: copy.tabs.all },
    { id: "indexed", label: copy.tabs.indexed },
    { id: "queue", label: copy.tabs.queue },
    { id: "failed", label: copy.tabs.failed }
  ];
}

export type TimelineRange = { id: string; label: string; hours: number };

export function timelineRanges(copy: PipelineCopy): TimelineRange[] {
  return [
    { id: "24h", label: copy.timeline.ranges.d24h, hours: 24 },
    { id: "7d", label: copy.timeline.ranges.d7d, hours: 24 * 7 },
    { id: "30d", label: copy.timeline.ranges.d30d, hours: 24 * 30 }
  ];
}

/** Headline numbers the API does not measure yet - rendered as labelled samples. */
export function sampleMetrics(copy: PipelineCopy): PipelineMetric[] {
  return [
    { label: copy.sampleLabels.queryLatency, value: "142", unit: "ms" },
    { label: copy.sampleLabels.retrievalScore, value: "0.94", unit: "cos" },
    { label: copy.sampleLabels.hitRate, value: "99.2", unit: "%" },
    { label: copy.sampleLabels.cacheRatio, value: "68.4", unit: "%" }
  ];
}

const LEAF_LIMIT = 4;

/** Synthetic branch that stands in for documents a cluster did not draw. Not a real node. */
export const OVERFLOW_LEAF_ID = "overflow";

/** Keeps a cluster honest: when the card counts more documents than it draws, the remainder gets its own branch. */
function withOverflow(items: PipelineLeaf[], total: number, copy: PipelineCopy): PipelineLeaf[] {
  if (total <= items.length) {
    return items;
  }
  return [...items, { id: OVERFLOW_LEAF_ID, name: copy.leaf.moreInCluster(total - items.length), href: "/documents" }];
}

function countFormat(value: number, locale = "en") {
  return new Intl.NumberFormat(locale).format(value);
}

function relativeTime(value: string, now: number, copy: PipelineCopy) {
  const minutes = Math.max(0, Math.round((now - new Date(value).getTime()) / 60000));
  if (minutes < 60) {
    return copy.leaf.agoMinutes(minutes);
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return copy.leaf.agoHours(hours);
  }

  return copy.leaf.agoDays(Math.round(hours / 24));
}

function truncate(value: string, length: number) {
  if (value.length <= length) {
    return value;
  }
  const clipped = value.slice(0, length - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${lastSpace > 8 ? clipped.slice(0, lastSpace) : clipped.trimEnd()}...`;
}

export function buildPipelineSnapshot(
  documents: DocumentItem[],
  health: IndexingHealth | null,
  vector: VectorHealth | null,
  rangeHours: number,
  copy: PipelineCopy,
  locale: string,
  errorText: (message: string) => string,
  now = Date.now()
): PipelineSnapshot {
  const readyDocuments = documents.filter((document) => document.status === "ready");
  const queuedDocuments = documents.filter((document) => document.status === "uploaded");
  const processingDocuments = documents.filter((document) => document.status === "processing");
  const failedDocuments = documents.filter((document) => document.status === "failed");
  const totalChunks = documents.reduce((sum, document) => sum + document.chunk_count, 0);
  const totalStorage = documents.reduce((sum, document) => sum + document.file_size, 0);
  const queueDepth = health?.queued_documents ?? queuedDocuments.length;
  const index = describeIndex(vector);

  const byRecent = (a: DocumentItem, b: DocumentItem) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();

  const clusters: PipelineCluster[] = [];

  if (readyDocuments.length > 0) {
    clusters.push({
      id: "indexed",
      title: copy.clusters.indexed.title,
      subtitle: copy.clusters.indexed.subtitle(copy.chunkCount(totalChunks)),
      badge: { label: copy.clusters.indexed.badge, tone: "lime" },
      items: withOverflow(
        [...readyDocuments].sort(byRecent).slice(0, LEAF_LIMIT).map((document) => ({
          id: document.id,
          name: truncate(document.filename, 34),
          meta: copy.leaf.tokens(countFormat(document.chunk_count, locale)),
          tag: document.file_type.toUpperCase(),
          chunkCount: document.chunk_count,
          href: `/documents/${document.id}`
        })),
        readyDocuments.length,
        copy
      )
    });
  }

  if (queuedDocuments.length + processingDocuments.length > 0) {
    clusters.push({
      id: "queue",
      title: copy.clusters.queue.title,
      subtitle: copy.clusters.queue.subtitle(queueDepth, processingDocuments.length),
      badge: { label: copy.clusters.queue.badge, tone: "dark" },
      items: withOverflow(
        [...queuedDocuments, ...processingDocuments].sort(byRecent).slice(0, LEAF_LIMIT).map((document) => ({
          id: document.id,
          name: truncate(document.filename, 34),
          meta: relativeTime(document.updated_at, now, copy),
          tag: document.status === "uploaded" ? copy.tags.queued : copy.tags.working,
          dot: document.status === "processing",
          chunkCount: document.chunk_count,
          href: `/documents/${document.id}`
        })),
        queuedDocuments.length + processingDocuments.length,
        copy
      )
    });
  }

  if (failedDocuments.length > 0) {
    clusters.push({
      id: "failed",
      title: copy.clusters.failed.title,
      subtitle: copy.clusters.failed.subtitle(failedDocuments.length),
      items: withOverflow(
        failedDocuments.sort(byRecent).slice(0, LEAF_LIMIT).map((document) => ({
          id: document.id,
          name: truncate(document.filename, 34),
          meta: truncate(errorText(document.error_message ?? copy.leaf.workerError), 28),
          tag: copy.tags.retry,
          chunkCount: document.chunk_count,
          href: `/documents/${document.id}`
        })),
        failedDocuments.length,
        copy
      )
    });
  }

  const windowStart = now - rangeHours * 60 * 60 * 1000;
  const events = documents
    .map((document) => new Date(document.created_at).getTime())
    .filter((timestamp) => timestamp >= windowStart && timestamp <= now)
    .map((timestamp) => Math.min(1, Math.max(0, (timestamp - windowStart) / (now - windowStart))))
    .sort((a, b) => a - b);

  const storage = formatBytes(totalStorage).split(" ");

  return {
    metrics: [
      { label: copy.metrics.documents, value: countFormat(documents.length, locale), unit: copy.metricUnits.files },
      { label: copy.metrics.ready, value: countFormat(readyDocuments.length, locale), unit: copy.metricUnits.indexed },
      {
        label: copy.metrics.inQueue,
        value: countFormat(queueDepth + processingDocuments.length, locale),
        unit: copy.metricUnits.pending
      },
      { label: copy.metrics.chunks, value: countFormat(totalChunks, locale), unit: copy.metricUnits.vectors },
      { label: copy.metrics.storage, value: storage[0], unit: storage[1] ?? "" }
    ],
    root: {
      name: copy.rootName,
      engine: "Qdrant",
      collection: index.collection,
      models: index.models,
      shape: index.shape,
      arms: index.arms,
      primary: copy.chunkCount(totalChunks),
      clusters: copy.activeClusters(clusters.length),
      files: countFormat(documents.length, locale)
    },
    clusters,
    events,
    ingestedChunks: copy.chunkCount(totalChunks)
  };
}
