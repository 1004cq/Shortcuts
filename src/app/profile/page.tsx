"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { membershipLabel, roleLabel } from "@/lib/permissions";
import type { SessionUser } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

export default function ProfilePage() {
  const { data } = useSession();
  const user = data?.user as SessionUser | undefined;
  const [logs, setLogs] = React.useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/downloads?scope=me&limit=20");
        const data = await res.json();
        if (res.ok) setLogs(data.items || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppShell showUpload={false} title="个人中心">
      <div className="mx-auto max-w-4xl space-y-6 animate-slide-up">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">账号信息</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">昵称</p>
              <p className="font-medium">{user?.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">邮箱</p>
              <p className="font-medium">{user?.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">角色</p>
              <Badge variant="secondary">{roleLabel(user?.role || "user")}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">会员</p>
              <Badge variant={user?.membership === "free" ? "outline" : "vip"}>
                {membershipLabel(user?.membership || "free")}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">邮箱验证</p>
              <p className="font-medium">{user?.emailVerified ? "已验证" : "未验证"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">会员到期</p>
              <p className="font-medium">
                {user?.membershipExpiresAt
                  ? format(new Date(user.membershipExpiresAt), "yyyy-MM-dd HH:mm")
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">最近下载 / 播放</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-24 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载中...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>文件</TableHead>
                    <TableHead>操作</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        暂无记录
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => {
                      const file = log.fileId as { name?: string } | null;
                      return (
                        <TableRow key={String(log._id)}>
                          <TableCell>{file?.name || "—"}</TableCell>
                          <TableCell>{String(log.action)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {log.createdAt
                              ? format(new Date(String(log.createdAt)), "yyyy-MM-dd HH:mm")
                              : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
