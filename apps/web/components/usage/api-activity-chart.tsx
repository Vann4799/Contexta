"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type UsageDayPoint = { date: string; label: string; allowed: number; rejected: number };

const ALLOWED_COLOR = "#d9e23a";
const REJECTED_COLOR = "#b54a4a";

// PostgREST gives no axis helpers, so pick round integer ticks here: 3-4 lines, never decimals.
function axisScale(max: number) {
  if (max <= 0) return { top: 4, ticks: [4, 2, 0] };
  const rawStep = max / 3;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? rawStep;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = top; v >= 0; v -= step) ticks.push(v);
  if (ticks[ticks.length - 1] !== 0) ticks.push(0);
  return { top, ticks };
}

export default function ApiActivityChart({
  data,
  allowedLabel,
  rejectedLabel,
  tapHint,
}: {
  data: UsageDayPoint[];
  allowedLabel: string;
  rejectedLabel: string;
  tapHint: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const peak = data.reduce((m, d) => Math.max(m, d.allowed + d.rejected), 0);
  const { top, ticks } = axisScale(peak);
  const active = selected === null ? null : data[selected];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 gap-2">
        <div className="relative w-5 shrink-0">
          {ticks.map((v, i) => (
            <span
              key={v}
              className="nums absolute right-0 -translate-y-1/2 text-[10px] leading-none text-ink-faint"
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
            >
              {v}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-0">
            {ticks.map((_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="absolute inset-x-0 border-t border-paper-line/70"
                style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
              />
            ))}
          </div>
          <div className="absolute inset-0 flex items-end gap-[3px]">
            {data.map((d, i) => {
              const total = d.allowed + d.rejected;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setSelected(i === selected ? null : i)}
                  aria-label={`${d.label}: ${allowedLabel} ${d.allowed}, ${rejectedLabel} ${d.rejected}`}
                  aria-pressed={i === selected}
                  className={cn(
                    "focus-ring flex h-full min-w-0 flex-1 flex-col justify-end rounded-t-[3px]",
                    i === selected ? "bg-paper-chip" : "hover:bg-paper-chip/60"
                  )}
                >
                  {total === 0 ? (
                    <span className="h-[2px] w-full rounded-t-[2px]" style={{ background: "#d4d0c8" }} />
                  ) : (
                    <span
                      className="flex w-full flex-col overflow-hidden rounded-t-[2px]"
                      style={{ height: `${(total / top) * 100}%` }}
                    >
                      <span
                        className="w-full shrink-0"
                        style={{ height: `${(d.rejected / total) * 100}%`, background: REJECTED_COLOR }}
                      />
                      <span className="w-full flex-1" style={{ background: ALLOWED_COLOR }} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mirrors the bar row's flex layout so each label stays under its own bar. One display
          class per breakpoint: `cn` has no merge step, so conflicting utilities would leak. */}
      <div className="mt-1 flex gap-[3px] pl-7 text-[10px] text-ink-faint">
        {data.map((d, i) => {
          const isLast = i === data.length - 1;
          return (
            <span
              key={d.date}
              className={cn(
                "min-w-0 flex-1 text-center whitespace-nowrap",
                isLast || i % 3 === 0 ? "block" : "hidden",
                isLast || i % 2 === 0 ? "sm:block" : "sm:hidden",
                "lg:block"
              )}
            >
              {d.label}
            </span>
          );
        })}
      </div>

      <p className="mt-1 h-4 truncate pl-7 text-[11px] text-ink-muted">
        {active
          ? `${active.label} — ${allowedLabel} ${active.allowed.toLocaleString()} · ${rejectedLabel} ${active.rejected.toLocaleString()}`
          : tapHint}
      </p>
    </div>
  );
}
