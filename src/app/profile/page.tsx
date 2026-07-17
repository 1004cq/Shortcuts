"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { membershipLabel, roleLabel, canDownload } from "@/lib/permissions";
import type { SessionUser } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, Loader2, RefreshCw } from "lucide-react";

export default function ProfilePage() {
  const { data } = useSession();
  const user = data?.user as SessionUser | undefined;
  const [logs, setLogs] = React.useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = React.useState(true);
  const [token, setToken] = React.useState("");
  const [downloadTemplate, setDownloadTemplate] = React.useState("");
  const [tokenLoading, setTokenLoading] = React.useState(false);
  const [tokenMsg, setTokenMsg] = React.useState("");

  const loadToken = React.useCallback(async (rotate = false) => {
    setTokenLoading(true);
    setTokenMsg("");
    try {
      const res = await fetch("/api/me/token", { method: rotate ? "POST" : "GET" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "获取 Token 失败");
      setToken(data.token || "");
      setDownloadTemplate(data.usage?.download || "");
      if (rotate) setTokenMsg(data.message || "已重新生成");
    } catch (err) {
      setTokenMsg(err instanceof Error ? err.message : "获取失败");
    } finally {
      setTokenLoading(false);
    }
  }, []);

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
    loadToken(false);
  }, [loadToken]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setTokenMsg("已复制到剪贴板");
    } catch {
      setTokenMsg("复制失败，请手动选择");
    }
  };

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
            <CardTitle className="font-display">苹果快捷指令 API Token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              用 Token 可以直接在快捷指令里「获取 URL 内容」，无需登录表单。
              {!canDownload(user) && (
                <span className="text-amber-500"> 免费用户无法下载，请先升级 VIP。</span>
              )}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={token} className="font-mono text-xs" />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!token}
                  onClick={() => copy(token)}
                >
                  <Copy className="h-4 w-4" />
                  复制
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={tokenLoading}
                  onClick={() => loadToken(true)}
                >
                  {tokenLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  重新生成
                </Button>
              </div>
            </div>
            {downloadTemplate && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium">快捷指令下载地址模板</p>
                <code className="block break-all text-xs text-muted-foreground">
                  {downloadTemplate}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => copy(downloadTemplate)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  复制模板
                </Button>
                <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>打开文件详情页，复制地址栏里的文件 ID</li>
                  <li>把模板里的 {"{fileId}"} 换成该 ID</li>
                  <li>
                    快捷指令：获取 URL 内容 → 编码媒体 → 播放声音（替换原来的本地文件）
                  </li>
                </ol>
              </div>
            )}
            {tokenMsg && <p className="text-sm text-success">{tokenMsg}</p>}
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
