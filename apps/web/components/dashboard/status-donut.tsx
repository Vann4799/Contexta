"use client";

export type DonutSlice = { name: string; value: number; color: string };

const R = 47;
const CIRC = 2 * Math.PI * R;
const GAP = 4;

export default function StatusDonut({ items }: { items: DonutSlice[] }) {
  if (items.length === 0) {
    return <div className="flex h-full items-center justify-center text-[13px] text-ink-muted">—</div>;
  }

  const total = items.reduce((sum, item) => sum + item.value, 0);
  // A single slice must close the ring: a gap on a full circle reads as a notch.
  const gap = items.length > 1 ? GAP : 0;
  let cursor = 0;

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox="0 0 120 120"
        className="h-full w-full"
        role="img"
        aria-label={items.map((i) => `${i.name}: ${i.value}`).join(", ")}
      >
        <g transform="rotate(-90 60 60)">
          {items.map((item) => {
            const arc = (item.value / (total || 1)) * CIRC;
            // Shortening each arc by the gap keeps segments in order without rotating them individually.
            const dash = Math.max(arc - gap, 0.5);
            const offset = -cursor;
            cursor += arc;
            return (
              <circle
                key={item.name}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={item.color}
                strokeWidth={15}
                strokeDasharray={`${dash} ${CIRC - dash}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </g>
      </svg>
      <span className="pointer-events-none absolute inset-0 grid place-items-center">
        <span className="nums text-[20px] font-semibold leading-none tracking-tight">{total}</span>
      </span>
    </div>
  );
}
