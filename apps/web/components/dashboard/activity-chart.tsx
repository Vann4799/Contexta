"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { axisScale } from "@/lib/chart-scale";

export interface ActivityBucket {
  date: string;
  label: string;
  uploads: number;
  indexed: number;
}

const H = 190;
const BASELINE = 185;
const SPAN = 180;

// The old chart drew into a fixed 560-unit viewBox with preserveAspectRatio="none", which at
// 390 px squashed every circle into an ellipse and gave the hover zones no real width to hit.
// Measuring the host keeps the drawing at 1:1 so strokes, dots and tap targets stay honest.
export function ActivityChart({
  buckets,
  uploadsLabel,
  indexedLabel,
  locale,
}: {
  buckets: ActivityBucket[];
  uploadsLabel: string;
  indexedLabel: string;
  locale: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const count = buckets.length;
  const step = count > 0 ? width / count : 0;
  const peak = buckets.reduce((m, b) => Math.max(m, b.uploads, b.indexed), 0);
  const { top, ticks } = axisScale(peak);
  const x = (i: number) => i * step + step / 2;
  const y = (v: number) => BASELINE - (Math.min(v, top) / top) * SPAN;

  const line = (value: (b: ActivityBucket) => number) =>
    buckets
      .map((b, i) => {
        if (i === 0) return `M ${x(0)},${y(value(b))}`;
        const prevY = y(value(buckets[i - 1]));
        return `C ${x(i - 1) + step / 3},${prevY} ${x(i) - step / 3},${y(value(b))} ${x(i)},${y(value(b))}`;
      })
      .join(" ");

  const area = (value: (b: ActivityBucket) => number) =>
    `${line(value)} L ${x(count - 1)},${BASELINE} L ${x(0)},${BASELINE} Z`;

  // Label density follows real column width, not the viewport: a wide desktop card shows all 14,
  // a 390 px card shows every third one.
  const every = step > 0 ? Math.max(1, Math.ceil(46 / step)) : 3;
  const shownLabels = new Set<number>();
  for (let i = 0; i < count; i += every) shownLabels.add(i);
  if (count > 0 && !shownLabels.has(count - 1)) {
    shownLabels.add(count - 1);
    if ((count - 2) % every === 0) shownLabels.delete(count - 2);
  }

  const tooltipDate =
    active === null
      ? ""
      : new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(buckets[active].date));
  const tooltipLeft = active === null ? 0 : Math.min(Math.max(x(active), 82), Math.max(width - 82, 82));

  return (
    <div className="relative h-[220px] w-full">
      <div className="pointer-events-none absolute left-0 top-0 h-[190px] w-6">
        {ticks.map((n, i) => (
          <span
            key={n}
            className="nums absolute left-0 -translate-y-1/2 text-[10px] text-ink-muted"
            style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
          >
            {n}
          </span>
        ))}
      </div>
      <div className="ml-6 min-w-0">
        <div ref={hostRef} className="relative h-[190px] w-full">
          {count === 0 || width === 0 ? null : (
            <>
              <svg
                width={width}
                height={H}
                viewBox={`0 0 ${width} ${H}`}
                className="block"
                onMouseLeave={() => setActive(null)}
              >
                {ticks.map((n) => (
                  <line
                    key={`grid-${n}`}
                    x1="0"
                    y1={y(n)}
                    x2={width}
                    y2={y(n)}
                    stroke="currentColor"
                    className="text-paper-line/40"
                    strokeWidth="1"
                  />
                ))}
                <path d={area((b) => b.indexed)} fill="#f2fb48" fillOpacity="0.05" />
                <path d={area((b) => b.uploads)} fill="#f2fb48" fillOpacity="0.1" />
                <path
                  d={line((b) => b.indexed)}
                  fill="none"
                  stroke="#f2fb48"
                  strokeWidth="2"
                  strokeOpacity="0.4"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={line((b) => b.uploads)}
                  fill="none"
                  stroke="#f2fb48"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {buckets.map((b, i) => (
                  <circle key={`idx-${b.date}`} cx={x(i)} cy={y(b.indexed)} r="3" fill="#f2fb48" fillOpacity="0.4" />
                ))}
                {buckets.map((b, i) => (
                  <circle key={`up-${b.date}`} cx={x(i)} cy={y(b.uploads)} r="4" fill="#f2fb48" />
                ))}
                {active !== null ? (
                  <line
                    x1={x(active)}
                    y1="5"
                    x2={x(active)}
                    y2={BASELINE}
                    stroke="currentColor"
                    className="text-paper-line"
                    strokeWidth="1"
                    strokeDasharray="4 2"
                  />
                ) : null}
                {buckets.map((b, i) => (
                  <rect
                    key={`hit-${b.date}`}
                    x={i * step}
                    y="0"
                    width={step}
                    height={H}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => setActive(i === active ? null : i)}
                  />
                ))}
              </svg>
              {active !== null ? (
                <div
                  className="absolute top-[10px] z-20 w-[164px] -translate-x-1/2 rounded-lg border border-paper-line bg-paper-card px-3 py-2 text-[12px] shadow-node"
                  style={{ left: tooltipLeft }}
                >
                  <p className="mb-1 font-medium text-ink-muted">{tooltipDate}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-ink-muted">
                      <span className="h-2 w-2 rounded-full bg-accent" />
                      {uploadsLabel}
                    </span>
                    <span className="nums font-semibold">{buckets[active].uploads}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-ink-muted">
                      <span className="h-2 w-2 rounded-full bg-accent opacity-40" />
                      {indexedLabel}
                    </span>
                    <span className="nums font-semibold">{buckets[active].indexed}</span>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="flex pt-1.5">
          {/* Suppressed labels stay in layout (visibility, not display): dropping a flex child
              would re-space the survivors off their own columns. */}
          {buckets.map((b, i) => (
            <span
              key={b.date}
              className="nums min-w-0 flex-1 text-center text-[10px] text-ink-muted"
              style={shownLabels.has(i) ? undefined : { visibility: "hidden" }}
            >
              {b.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
