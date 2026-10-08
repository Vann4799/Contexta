"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CircleHelp,
  FileText,
  LifeBuoy,
  MessageSquareText,
  RefreshCw,
  Server,
  type LucideIcon
} from "lucide-react";
import { useT } from "@/lib/i18n";

const STEP_ICONS: { key: "upload" | "chat" | "ask"; icon: LucideIcon }[] = [
  { key: "upload", icon: FileText },
  { key: "chat", icon: MessageSquareText },
  { key: "ask", icon: Bot }
];

const PROBLEM_ICONS: { key: "stuck" | "slow" | "numbers" | "convert"; icon: LucideIcon }[] = [
  { key: "stuck", icon: RefreshCw },
  { key: "slow", icon: AlertTriangle },
  { key: "numbers", icon: CircleHelp },
  { key: "convert", icon: Server }
];

const EXAMPLE_KEYS = ["summary", "problem", "topCreator", "countPosts", "topLiked", "insights"] as const;

export function HelpPanel() {
  const t = useT().help;

  return (
    <div className="space-y-3">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h2 className="mt-2 text-[26px] font-semibold text-ink">{t.title}</h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-ink-muted">{t.intro}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/documents"
            className="inline-flex h-10 items-center justify-center rounded-card border border-paper-line bg-paper-card px-4 text-[13px] font-semibold text-ink transition hover:border-ink hover:text-ink"
          >
            {t.manageDocuments}
          </Link>
          <Link
            href="/chat"
            className="inline-flex h-10 items-center justify-center rounded-card border border-ink bg-night px-4 text-[13px] font-semibold text-white transition hover:bg-night-raised"
          >
            {t.openChat}
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {STEP_ICONS.map(({ key, icon: Icon }) => (
          <article key={key} className="rounded-card border border-paper-line bg-paper-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-card bg-paper-chip text-ink">
              <Icon className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-[15px] font-semibold text-ink">{t.steps[key].title}</h3>
            <p className="mt-2 text-[13px] leading-6 text-ink-muted">{t.steps[key].description}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-12">
        <article className="rounded-card border border-paper-line bg-paper-card p-6 lg:col-span-7">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-paper-chip text-ink">
              <LifeBuoy className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-[17px] font-semibold text-ink">{t.troubleshooting.title}</h3>
              <p className="mt-1 text-[13px] text-ink-muted">{t.troubleshooting.subtitle}</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {PROBLEM_ICONS.map(({ key, icon: Icon }) => (
              <div key={key} className="rounded-control border border-paper-line bg-paper p-4">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <Icon className="h-4 w-4 text-ink" strokeWidth={2.1} aria-hidden="true" />
                  {t.troubleshooting.items[key].problem}
                </div>
                <p className="mt-2 text-[13px] leading-6 text-ink-muted">{t.troubleshooting.items[key].answer}</p>
              </div>
            ))}
          </div>
        </article>

        <aside className="space-y-4 lg:col-span-5">
          <article className="rounded-card border border-paper-line bg-paper-card p-5">
            <h3 className="text-[17px] font-semibold text-ink">{t.examples.title}</h3>
            <div className="mt-4 space-y-2">
              {EXAMPLE_KEYS.map((key) => (
                <p key={key} className="rounded-card border border-paper-line bg-paper px-4 py-3 text-[13px] text-ink">
                  {t.examples[key]}
                </p>
              ))}
            </div>
          </article>

        </aside>
      </section>
    </div>
  );
}
