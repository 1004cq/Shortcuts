"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const actionLabel: Record<string, string> = {
  download: "下载",
  stream: "播放",
  preview: "预览",
};

export function RealtimeActivityTable({
  rows,
}: {
  rows: Array<Record<string, unknown>>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-muted-foreground">用户</TableHead>
            <TableHead className="text-muted-foreground">文件</TableHead>
            <TableHead className="text-muted-foreground">操作</TableHead>
            <TableHead className="text-right text-muted-foreground">时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="border-white/10">
              <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                暂无实时活动
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const u = row.userId as { name?: string; email?: string; username?: string } | null;
              const f = row.fileId as { name?: string } | null;
              const action = String(row.action || "");
              return (
                <TableRow
                  key={String(row._id)}
                  className="border-white/10 transition-colors hover:bg-white/[0.04]"
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{u?.name || u?.email || "—"}</p>
                      {u?.username ? (
                        <p className="text-xs text-muted-foreground">@{u.username}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate">{f?.name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="border border-white/10 bg-white/5">
                      {actionLabel[action] || action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {row.createdAt
                      ? format(new Date(String(row.createdAt)), "MM-dd HH:mm:ss")
                      : "—"}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
