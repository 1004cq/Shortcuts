"use client";

import * as React from "react";
import { Users, HardDrive, Download, Crown, Database } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes } from "@/lib/utils";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Stats = {
  users: number;
  vipUsers: number;
  files: number;
  downloads: number;
  activeSubs: number;
  totalStorageBytes: number;
};

export default function AdminDashboardPage() {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [recent, setRecent] = React.useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/stats");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "加载失败");
        setStats(data.stats);
        setRecent(data.recentDownloads || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cards = stats
    ? [
        { label: "用户总数", value: stats.users, icon: Users },
        { label: "VIP / 管理", value: stats.vipUsers, icon: Crown },
        { label: "文件数", value: stats.files, icon: HardDrive },
        { label: "下载次数", value: stats.downloads, icon: Download },
        { label: "活跃订阅", value: stats.activeSubs, icon: Crown },
        { label: "存储占用", value: formatBytes(stats.totalStorageBytes), icon: Database },
      ]
    : [];

  return (
    <AdminShell title="仪表盘">
      {loading ? (
        <div className="flex h-40 items-center justify-center text-slate-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(({ label, value, icon: Icon }) => (
              <Card key={label} className="border-slate-800 bg-slate-900/60 text-slate-100">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">{label}</CardTitle>
                  <Icon className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl font-bold">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-slate-800 bg-slate-900/60 text-slate-100">
            <CardHeader>
              <CardTitle className="font-display">最近活动</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">用户</TableHead>
                    <TableHead className="text-slate-400">文件</TableHead>
                    <TableHead className="text-slate-400">操作</TableHead>
                    <TableHead className="text-slate-400">时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((row) => {
                    const u = row.userId as { name?: string; email?: string } | null;
                    const f = row.fileId as { name?: string } | null;
                    return (
                      <TableRow key={String(row._id)} className="border-slate-800">
                        <TableCell>{u?.name || u?.email || "—"}</TableCell>
                        <TableCell>{f?.name || "—"}</TableCell>
                        <TableCell>{String(row.action)}</TableCell>
                        <TableCell className="text-slate-400">
                          {row.createdAt
                            ? format(new Date(String(row.createdAt)), "MM-dd HH:mm")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
