"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartColors } from "@/components/admin/charts/ChartTheme";

type Point = { date: string; downloads: number; streams: number; previews: number };

export function ActivityLineChart({ data }: { data: Point[] }) {
  const c = useChartColors();

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="dlFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.linePrimary} stopOpacity={0.45} />
              <stop offset="100%" stopColor={c.linePrimary} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="stFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.lineSecondary} stopOpacity={0.4} />
              <stop offset="100%" stopColor={c.lineSecondary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" stroke={c.axis} fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke={c.axis} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: c.tooltipBg,
              border: `1px solid ${c.tooltipBorder}`,
              borderRadius: 12,
              color: c.tooltipText,
              backdropFilter: "blur(12px)",
            }}
            labelStyle={{ color: c.tooltipText }}
          />
          <Area
            type="monotone"
            dataKey="downloads"
            name="下载"
            stroke={c.linePrimary}
            fill="url(#dlFill)"
            strokeWidth={2.5}
            animationDuration={900}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="streams"
            name="播放"
            stroke={c.lineSecondary}
            fill="url(#stFill)"
            strokeWidth={2.5}
            animationDuration={1100}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
