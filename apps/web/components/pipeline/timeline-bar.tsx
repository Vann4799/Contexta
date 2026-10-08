"use client";

import { useState } from "react";
import { CalendarClock, ChevronDown } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n";
import type { TimelineRange } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

type TimelineBarProps = {
  events: number[];
  ingestedChunks: string;
  pendingCount: number;
  range: TimelineRange;
  ranges: TimelineRange[];
  onRangeChange: (range: TimelineRange) => void;
};

const TICK_COUNT = 7;

export function TimelineBar({ events, ingestedChunks, pendingCount, range, ranges, onRangeChange }: TimelineBarProps) {
  const t = useT();
  const locale = useLocale();
  const copy = t.pipeline.timeline;
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0.5);

  const now = Date.now();
  const tickFormatter = new Intl.DateTimeFormat(locale,
    range.hours <= 24 ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short" }
  );
  const ticks = Array.from({ length: TICK_COUNT }, (_, index) => {
    const position = index / (TICK_COUNT - 1);
    return tickFormatter.format(now - range.hours * 3600_000 * (1 - position));
  });

  return (
    <section className="surface flex flex-col gap-4 px-5 py-3.5 lg:flex-row lg:items-center lg:gap-8">
      <div className="relative shrink-0">
        <button
          aria-expanded={open}
          className="focus-ring inline-flex h-8 items-center gap-2 rounded-control bg-paper-chip px-3 text-[13px] font-medium"
          type="button"
          onClick={() => setOpen((value) => !value)}
        >
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
          {range.label}
          <ChevronDown className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
        </button>
        {open ? (
          <ul className="surface absolute bottom-10 left-0 z-20 w-44 p-1 text-[13px]">
            {ranges.map((option) => (
              <li key={option.id}>
                <button
                  className={cn(
                    "w-full rounded-control px-2.5 py-1.5 text-left",
                    option.id === range.id ? "bg-paper-chip font-medium" : "hover:bg-paper-soft"
                  )}
                  type="button"
                  onClick={() => {
                    onRangeChange(option);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="relative min-w-0 flex-1 select-none">
        <div
          className="relative h-8 cursor-pointer"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setCursor(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)));
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-paper-line" />
          <div className="relative flex h-full items-center justify-between px-1">
            {ticks.map((tick, index) => {
              const position = index / (TICK_COUNT - 1);
              const near = Math.abs(position - cursor) < 0.06;
              return (
                <span
                  className={cn(
                    "nums relative z-10 bg-paper-card px-1 font-mono text-[11px] sm:px-1.5 sm:text-[12.5px]",
                    index % 2 === 1 ? "hidden sm:inline" : "",
                    near ? "font-semibold text-ink" : "text-ink-muted"
                  )}
                  key={`${tick}-${index}`}
                >
                  {tick}
                </span>
              );
            })}
          </div>
          {events.map((position, index) => (
            <span
              className="absolute top-1/2 z-20 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] bg-accent ring-1 ring-ink/80"
              key={`${position}-${index}`}
              style={{ left: `${position * 100}%` }}
            />
          ))}
          <span className="absolute top-0 z-0 h-full w-px bg-ink/70 transition-[left] duration-300" style={{ left: `${cursor * 100}%` }} />
        </div>
        {events.length === 0 ? (
          <p className="text-[11.5px] text-ink-muted">{copy.noEvents}</p>
        ) : (
          <p className="text-[11.5px] text-ink-muted">{copy.plotted(events.length, range.label)}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 rounded-control bg-night px-4 py-2 text-[12.5px]">
        <span className="text-white/70">
          {copy.ingested} <span className="nums font-medium text-white">{ingestedChunks}</span>
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        <span className="font-medium text-white">
          {copy.pending(pendingCount)}
        </span>
      </div>
    </section>
  );
}
