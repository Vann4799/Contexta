"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type UsageDayPoint = { label: string; allowed: number; rejected: number };

export default function ApiActivityChart({
  data,
  allowedLabel,
  rejectedLabel
}: {
  data: UsageDayPoint[];
  allowedLabel: string;
  rejectedLabel: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "#8b8680" }}
          interval="preserveStartEnd"
        />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#8b8680" }} allowDecimals={false} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="rounded-lg border border-paper-line bg-paper-card px-3 py-2 text-[12px] shadow-node">
                <p className="mb-1 font-medium text-ink-muted">{label}</p>
                {payload.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                    <span className="text-ink-muted">{entry.name}:</span>
                    <span className="font-semibold nums">{entry.value}</span>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Bar dataKey="allowed" name={allowedLabel} stackId="a" fill="#4f7e4d" radius={[0, 0, 0, 0]} barSize={20} />
        <Bar dataKey="rejected" name={rejectedLabel} stackId="a" fill="#b54a4a" radius={[4, 4, 0, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
