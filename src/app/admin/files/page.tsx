"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Trash2, Loader2, Upload } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "@/components/files/UploadDialog";
import { formatBytes } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FileItem } from "@/types";

export default function AdminFilesPage() {
  const [items, setItems] = React.useState<FileItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/files?limit=100&sort=newest");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载失败");
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    if (!confirm("确认删除该文件？")) return;
    const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
    if (res.ok) load();
  };

  return (
    <AdminShell title="文件管理">
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" />
          上传文件
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
                <TableHead className="text-slate-400">名称</TableHead>
                <TableHead className="text-slate-400">分类</TableHead>
                <TableHead className="text-slate-400">大小</TableHead>
                <TableHead className="text-slate-400">下载</TableHead>
                <TableHead className="text-slate-400">上传时间</TableHead>
                <TableHead className="text-right text-slate-400">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((f) => (
                <TableRow key={f._id} className="border-slate-800">
                  <TableCell>
                    <Link href={`/files/${f._id}`} className="text-primary hover:underline">
                      {f.name}
                    </Link>
                  </TableCell>
                  <TableCell>{f.category}</TableCell>
                  <TableCell>{formatBytes(f.size)}</TableCell>
                  <TableCell>{f.downloadCount}</TableCell>
                  <TableCell className="text-slate-400">
                    {format(new Date(f.createdAt), "yyyy-MM-dd HH:mm")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => remove(f._id)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onUploaded={load} />
    </AdminShell>
  );
}
