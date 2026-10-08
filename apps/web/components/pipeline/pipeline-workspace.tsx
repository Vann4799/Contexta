"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getIndexingHealth, getVectorHealth, listDocuments, type DocumentItem, type IndexingHealth, type VectorHealth } from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useLocale, useT } from "@/lib/i18n";
import type { Dictionary } from "@/locales/en";
import { buildPipelineSnapshot, timelineRanges } from "@/lib/pipeline";
import { useServerError } from "@/lib/server-errors";
import { IndexHeader } from "@/components/pipeline/index-header";
import { SynapseGraph } from "@/components/pipeline/synapse-graph";
import { TimelineBar } from "@/components/pipeline/timeline-bar";

type PipelineCopy = Dictionary["pipeline"];

export function PipelineWorkspace() {
  const t = useT();
  const locale = useLocale();
  const copy = t.pipeline;
  const serverError = useServerError();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [health, setHealth] = useState<IndexingHealth | null>(null);
  const [vector, setVector] = useState<VectorHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [rangeId, setRangeId] = useState("24h");

  const ranges = useMemo(() => timelineRanges(copy), [copy]);
  const range = ranges.find((item) => item.id === rangeId) ?? ranges[0];

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
        setError("signIn");
        return;
      }

      setDocuments(await listDocuments(accessToken));
      try {
        setHealth(await getIndexingHealth());
      } catch {
        setHealth(null);
      }
      try {
        setVector(await getVectorHealth());
      } catch {
        setVector(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error && loadError.message ? loadError.message : "failed");
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

  const snapshot = useMemo(
    () => buildPipelineSnapshot(documents, health, vector, range.hours, copy, locale, serverError),
    [copy, documents, health, locale, range.hours, serverError, vector]
  );

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
        root={snapshot.root}
        onTabChange={setActiveTab}
      />

      {error ? (
        <section className="surface px-5 py-4 text-[13.5px] text-danger">
          {copy.errors[error as keyof PipelineCopy["errors"]] ?? serverError(error)}
        </section>
      ) : null}

      <SynapseGraph clusters={visibleClusters} root={snapshot.root} />

      <TimelineBar
        events={snapshot.events}
        ingestedChunks={snapshot.ingestedChunks}
        pendingCount={pendingCount}
        range={range}
        ranges={ranges}
        onRangeChange={(next) => setRangeId(next.id)}
      />
    </div>
  );
}
