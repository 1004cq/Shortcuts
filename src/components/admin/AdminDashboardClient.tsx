"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Activity,
  Crown,
  Database,
  Download,
  HardDrive,
  Loader2,
  Play,
  Radio,
  Users,
} from "lucide-react";
import { KpiCard } from "@/components/admin/KpiCard";
import { GlassCard } from "@/components/admin/GlassCard";
import { ActivityLineChart } from "@/components/admin/charts/ActivityLineChart";
import { CategoryBarChart } from "@/components/admin/charts/CategoryBarChart";
import { RolePieChart } from "@/components/admin/charts/RolePieChart";
import { RealtimeActivityTable } from "@/components/admin/RealtimeActivityTable";
import { useAdminDashboardStore } from "@/store/admin-dashboard";
import { formatBytes } from "@/lib/utils";
import type { AdminStatsPayload } from "@/lib/admin-stats";
import { Badge } from "@/components/ui/badge";

export function AdminDashboardClient() {
  const { data, loading, error, live, lastUpdated, setData, setError, setLoading, setLive } =
    useAdminDashboardStore();

  React.useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    const bootstrap = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/stats");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "加载失败");
        if (!cancelled) setData(json as AdminStatsPayload);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载失败");
          setLoading(false);
        }
        return;
      }

      if (cancelled) return;
      es = new EventSource("/api/admin/stats/stream");
      es.addEventListener("stats", (evt) => {
        try {
          const payload = JSON.parse((evt as MessageEvent).data) as AdminStatsPayload;
          setData(payload);
          setLive(true);
        } catch {
          /* ignore malformed frames */
        }
      });
      es.onerror = () => {
        setLive(false);
      };
      es.onopen = () => setLive(true);
    };

    void bootstrap();

    return () => {
      cancelled = true;
      setLive(false);
      es?.close();
    };
  }, [setData, setError, setLoading, setLive]);

  if (loading && !data) {
    return (
      <div className="flex h-56 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        正在加载实时仪表盘...
      </div>
    );
  }

  if (error && !data) {
    return <p className="text-destructive">{error}</p>;
  }

  if (!data) return null;

  const { stats, series, recentDownloads } = data;

  const kpis = [
    {
      label: "用户总数",
      value: stats.users,
      hint: "含全部角色",
      icon: Users,
      glow: "cyan" as const,
      accentClass: "text-sky-300",
    },
    {
      label: "VIP / 管理",
      value: stats.vipUsers,
      hint: "高权限账号",
      icon: Crown,
      glow: "amber" as const,
      accentClass: "text-amber-300",
    },
    {
      label: "文件数",
      value: stats.files,
      hint: "媒体库资产",
      icon: HardDrive,
      glow: "violet" as const,
      accentClass: "text-violet-300",
    },
    {
      label: "下载次数",
      value: stats.downloads,
      hint: "累计下载",
      icon: Download,
      glow: "cyan" as const,
      accentClass: "text-sky-300",
    },
    {
      label: "播放次数",
      value: stats.streams,
      hint: "流式访问",
      icon: Play,
      glow: "violet" as const,
      accentClass: "text-fuchsia-300",
    },
    {
      label: "存储占用",
      value: formatBytes(stats.totalStorageBytes),
      hint: `活跃订阅 ${stats.activeSubs}`,
      icon: Database,
      glow: "emerald" as const,
      accentClass: "text-emerald-300",
    },
  ];

  return (
    <div className="space-y-6 xl:space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Realtime Ops</p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            实时数据仪表盘
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="gap-1.5 border border-white/10 bg-white/5 px-3 py-1 text-xs"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-emerald-400" : "bg-amber-400"}`}
            />
            {live ? "SSE 已连接" : "轮询中断 / 重连中"}
          </Badge>
          {lastUpdated ? (
            <span className="text-xs text-muted-foreground">
              更新于 {format(new Date(lastUpdated), "HH:mm:ss")}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <GlassCard glow="cyan" className="p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-display text-lg font-semibold">14 日活动趋势</p>
              <p className="text-xs text-muted-foreground">下载与播放平滑曲线</p>
            </div>
            <Activity className="h-4 w-4 text-sky-300" />
          </div>
          <ActivityLineChart data={series.activityByDay} />
        </GlassCard>

        <GlassCard glow="violet" className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-display text-lg font-semibold">用户构成</p>
              <p className="text-xs text-muted-foreground">角色分布</p>
            </div>
            <Users className="h-4 w-4 text-violet-300" />
          </div>
          <RolePieChart data={series.roles} />
        </GlassCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <GlassCard glow="emerald" className="p-5 xl:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-display text-lg font-semibold">文件分类</p>
              <p className="text-xs text-muted-foreground">柱状对比</p>
            </div>
            <HardDrive className="h-4 w-4 text-emerald-300" />
          </div>
          <CategoryBarChart data={series.categories} />
        </GlassCard>

        <GlassCard glow="amber" className="p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-display text-lg font-semibold">实时活动</p>
              <p className="text-xs text-muted-foreground">最近下载 / 播放 / 预览</p>
            </div>
            <Radio className="h-4 w-4 text-amber-300" />
          </div>
          <RealtimeActivityTable rows={recentDownloads} />
        </GlassCard>
      </div>
    </div>
  );
}
