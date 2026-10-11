"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  Trash2,
  Zap
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { ActivityEvent, ActivityEventType } from "@/lib/api";
import { getActivityEvents } from "@/lib/api";
import { useT } from "@/lib/i18n";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function getEventIcon(eventType: ActivityEventType) {
  switch (eventType) {
    case "document_uploaded":
      return FileText;
    case "document_processing":
      return Loader2;
    case "document_ready":
      return CheckCircle2;
    case "document_failed":
      return AlertCircle;
    case "document_trashed":
      return Trash2;
    case "chat_message":
      return MessageSquare;
    case "api_request":
      return Zap;
    default:
      return ActivityIcon;
  }
}

function getEventIconColor(eventType: ActivityEventType): string {
  switch (eventType) {
    case "document_ready":
      return "text-amber-600 bg-amber-50";
    case "document_failed":
      return "text-red-600 bg-red-50";
    case "document_processing":
      return "text-blue-600 bg-blue-50";
    case "document_trashed":
      return "text-ink-muted bg-ink-muted/10";
    case "chat_message":
      return "text-purple-600 bg-purple-50";
    case "api_request":
      return "text-ink-muted bg-ink-muted/10";
    default:
      return "text-ink-muted bg-ink-muted/10";
  }
}

export function ActivityPanel() {
  const t = useT();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError("Not authenticated");
        return;
      }
      const feed = await getActivityEvents(token, 50, 0);
      setEvents(feed.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  return (
    <div className="space-y-4">
      <section className="surface p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="eyebrow">{t.activity.eyebrow}</p>
            <h2 className="mt-1 text-[22px] font-semibold text-ink">{t.activity.title}</h2>
          </div>
          <button
            type="button"
            onClick={() => void loadEvents()}
            disabled={loading}
            className="focus-ring flex items-center gap-2 rounded-control border border-ink-border px-3 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-paper-soft hover:text-ink disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
            {t.activity.refresh}
          </button>
        </div>

        {loading && events.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-ink-muted" strokeWidth={2} />
          </div>
        ) : error ? (
          <div className="rounded-control border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-[13px] text-red-900">{error}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-muted/10">
              <Clock className="h-6 w-6 text-ink-muted" strokeWidth={2} />
            </div>
            <p className="mt-4 text-[14px] text-ink-muted">{t.activity.noActivity}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => {
              const Icon = getEventIcon(event.event_type);
              const colorClass = getEventIconColor(event.event_type);
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 rounded-control border border-ink-border p-3 transition-colors hover:bg-paper-soft"
                >
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${colorClass}`}>
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink">{event.title}</p>
                    {event.description ? (
                      <p className="mt-0.5 text-[12px] text-ink-muted line-clamp-2">{event.description}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-ink-muted">{formatRelativeTime(event.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
