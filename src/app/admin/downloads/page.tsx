"use client";

import * as React from "react";
import { format } from "date-fns";
import { Download, Loader2 } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AdminDownloadsPage() {
  const [items, setItems] = React.useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/downloads?scope=all&limit=100");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "加载失败");
        setItems(data.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AdminShell title="下载统计">
      <div className="mb-4 flex justify-end">
        <Button asChild variant="secondary">
          <a href="/api/downloads?scope=all&export=csv">
            <Download className="h-4 w-4" />
            导出 CSV
          </a>
        </Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-slate-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">用户</TableHead>
                <TableHead className="text-slate-400">文件</TableHead>
                <TableHead className="text-slate-400">操作</TableHead>
                <TableHead className="text-slate-400">IP</TableHead>
                <TableHead className="text-slate-400">时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={5} className="text-center text-slate-500">
                    暂无记录
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => {
                  const u = row.userId as { name?: string; email?: string } | null;
                  const f = row.fileId as { name?: string } | null;
                  return (
                    <TableRow key={String(row._id)} className="border-slate-800">
                      <TableCell>
                        <div>
                          <p>{u?.name || "—"}</p>
                          <p className="text-xs text-slate-500">{u?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{f?.name || "—"}</TableCell>
                      <TableCell>{String(row.action)}</TableCell>
                      <TableCell className="text-slate-400">{String(row.ipAddress || "—")}</TableCell>
                      <TableCell className="text-slate-400">
                        {row.createdAt
                          ? format(new Date(String(row.createdAt)), "yyyy-MM-dd HH:mm:ss")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminShell>
  );
}
