"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartColors } from "@/components/admin/charts/ChartTheme";

const palette = ["#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#f472b6"];

export function CategoryBarChart({ data }: { data: Array<{ name: string; value: number }> }) {
  const c = useChartColors();

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" stroke={c.axis} fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke={c.axis} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.08)" }}
            contentStyle={{
              background: c.tooltipBg,
              border: `1px solid ${c.tooltipBorder}`,
              borderRadius: 12,
              color: c.tooltipText,
              backdropFilter: "blur(12px)",
            }}
          />
          <Bar dataKey="value" name="文件数" radius={[10, 10, 4, 4]} animationDuration={900}>
            {data.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
