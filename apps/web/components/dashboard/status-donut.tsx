"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type DonutSlice = { name: string; value: number; color: string };

export default function StatusDonut({ items }: { items: DonutSlice[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={items}
          dataKey="value"
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={58}
          paddingAngle={3}
          strokeWidth={0}
        >
          {items.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload as { name: string; value: number };
            return (
              <div className="rounded-lg border border-paper-line bg-paper-card px-3 py-1.5 text-[12px] shadow-node">
                <span className="font-medium">{d.name}:</span>{" "}
                <span className="nums font-semibold">{d.value}</span>
              </div>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
