"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getIndexingHealth, listDocuments, type DocumentItem, type IndexingHealth } from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { buildPipelineSnapshot, SAMPLE_METRICS, TIMELINE_RANGES, type TimelineRange } from "@/lib/pipeline";
import { IndexHeader } from "@/components/pipeline/index-header";
import { SynapseGraph } from "@/components/pipeline/synapse-graph";
import { TimelineBar } from "@/components/pipeline/timeline-bar";

export function PipelineWorkspace() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [health, setHealth] = useState<IndexingHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [range, setRange] = useState<TimelineRange>(TIMELINE_RANGES[0]);

  const getAccessToken = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const load = useCallback(async () => {
    setError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Sign in to view pipeline dynamics.");
      }

      setDocuments(await listDocuments(accessToken));
      try {
        setHealth(await getIndexingHealth());
      } catch {
        setHealth(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load pipeline dynamics.");
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = documents.filter((document) => document.status === "uploaded" || document.status === "processing").length;

  useEffect(() => {
    if (pendingCount === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void load();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [load, pendingCount]);

  const snapshot = useMemo(() => buildPipelineSnapshot(documents, health, range.hours), [documents, health, range.hours]);

  const visibleClusters = useMemo(
    () => (activeTab === "all" ? snapshot.clusters : snapshot.clusters.filter((cluster) => cluster.id === activeTab)),
    [activeTab, snapshot.clusters]
  );

  return (
    <div className="flex flex-col gap-3">
      <IndexHeader
        activeTab={activeTab}
        health={health}
        isLoading={isLoading}
        metrics={snapshot.metrics}
        sampleMetrics={SAMPLE_METRICS}
        onTabChange={setActiveTab}
      />

      {error ? <section className="surface px-5 py-4 text-[13.5px] text-danger">{error}</section> : null}

      <SynapseGraph clusters={visibleClusters} root={snapshot.root} />

      <TimelineBar
        events={snapshot.events}
        ingestedChunks={snapshot.ingestedChunks}
        pendingCount={pendingCount}
        range={range}
        onRangeChange={setRange}
      />
    </div>
  );
}
