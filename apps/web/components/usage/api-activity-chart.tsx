"use client";

import { useState } from "react";
import { axisScale } from "@/lib/chart-scale";
import { cn } from "@/lib/utils";

export type UsageDayPoint = { date: string; label: string; allowed: number; rejected: number };

const ALLOWED_COLOR = "#d9e23a";
const REJECTED_COLOR = "#b54a4a";

// Which x labels survive at a given column density. The forced last label needs breathing room
// or it collides with the tick that landed one column before it.
function labelSet(n: number, every: number) {
  const shown = new Set<number>();
  for (let i = 0; i < n; i += every) shown.add(i);
  const last = n - 1;
  if (!shown.has(last)) {
    shown.add(last);
    if (n > 6 && (last - 1) % every === 0) shown.delete(last - 1);
  }
  return shown;
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
  const mobileLabels = labelSet(data.length, 3);
  const smLabels = labelSet(data.length, 2);
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
                    "focus-ring relative flex h-full min-w-0 flex-1 flex-col justify-end rounded-t-[3px]",
                    i === selected ? "bg-paper-chip/40" : "hover:bg-paper-chip/25"
                  )}
                >
                  {i === selected ? (
                    <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-ink" />
                  ) : null}
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

      {/* Mirrors the bar row's flex layout so each label sits under its own bar. Suppressed
          labels use visibility, not display: dropping a flex child re-spaces the survivors. */}
      <div className="mt-1 flex gap-[3px] pl-7 text-[10px] text-ink-faint">
        {data.map((d, i) => (
          <span
            key={d.date}
            className={cn(
              "min-w-0 flex-1 text-center whitespace-nowrap",
              mobileLabels.has(i) ? "visible" : "invisible",
              smLabels.has(i) ? "sm:visible" : "sm:invisible",
              "lg:visible"
            )}
          >
            {d.label}
          </span>
        ))}
      </div>

      <p className="mt-1 h-4 truncate pl-7 text-[11px] text-ink-muted">
        {active
          ? `${active.label} — ${allowedLabel} ${active.allowed.toLocaleString()} · ${rejectedLabel} ${active.rejected.toLocaleString()}`
          : tapHint}
      </p>
    </div>
  );
}
