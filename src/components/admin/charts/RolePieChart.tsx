"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useChartColors } from "@/components/admin/charts/ChartTheme";

type Slice = { name: string; value: number; fill: string };

export function RolePieChart({ data }: { data: Slice[] }) {
  const c = useChartColors();
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div className="relative h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            contentStyle={{
              background: c.tooltipBg,
              border: `1px solid ${c.tooltipBorder}`,
              borderRadius: 12,
              color: c.tooltipText,
              backdropFilter: "blur(12px)",
            }}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={3}
            animationDuration={1000}
            stroke="transparent"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} className="outline-none transition-opacity hover:opacity-90" />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-xs text-muted-foreground">用户</p>
        <p className="font-display text-2xl font-semibold">{total}</p>
      </div>
    </div>
  );
}
