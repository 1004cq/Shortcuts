"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { copyToClipboard } from "@/lib/clipboard";

type ProfileItem = {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  phone?: string | null;
  role: string;
  membership: string;
  membershipExpiresAt?: string | null;
  emailVerified: boolean;
};

export default function ProfilePage() {
  const { data, update } = useSession();
  const user = data?.user as SessionUser | undefined;
  const [logs, setLogs] = React.useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = React.useState(true);
  const [token, setToken] = React.useState("");
  const [downloadTemplate, setDownloadTemplate] = React.useState("");
  const [tokenLoading, setTokenLoading] = React.useState(false);
  const [tokenMsg, setTokenMsg] = React.useState("");

  const [profile, setProfile] = React.useState<ProfileItem | null>(null);
  const [name, setName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [profileMsg, setProfileMsg] = React.useState("");
  const [profileError, setProfileError] = React.useState("");

  const applyProfile = React.useCallback((item: ProfileItem) => {
    setProfile(item);
    setName(item.name || "");
    setUsername(item.username || "");
    setPhone(item.phone || "");
  }, []);

  const loadProfile = React.useCallback(async () => {
    const res = await fetch("/api/me");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "加载资料失败");
    applyProfile(data.item as ProfileItem);
  }, [applyProfile]);

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
        const [logsRes] = await Promise.all([
          fetch("/api/downloads?scope=me&limit=20"),
          loadProfile().catch(() => undefined),
        ]);
        const data = await logsRes.json();
        if (logsRes.ok) setLogs(data.items || []);
      } finally {
        setLoading(false);
      }
    })();
    loadToken(false);
  }, [loadToken, loadProfile]);

  const copy = async (text: string) => {
    const ok = await copyToClipboard(text);
    setTokenMsg(ok ? "已复制到剪贴板" : "请在弹出框中手动复制");
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setProfileMsg("");
    setProfileError("");
    try {
      const payload: Record<string, string | null> = {
        name: name.trim(),
        phone: phone.trim() ? phone.trim() : null,
      };
      if (username.trim()) {
        payload.username = username.trim().toLowerCase();
      }
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      const item = data.item as ProfileItem;
      applyProfile(item);
      await update({
        name: item.name,
        username: item.username,
        phone: item.phone,
      });
      setProfileMsg("资料已更新");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const displayId = profile?.id || user?.id || "—";
  const displayEmail = profile?.email || user?.email || "—";
  const displayRole = profile?.role || user?.role || "user";
  const displayMembership = profile?.membership || user?.membership || "free";
  const displayVerified =
    profile?.emailVerified ?? user?.emailVerified ?? false;
  const displayExpires =
    profile?.membershipExpiresAt ?? user?.membershipExpiresAt ?? null;

  return (
    <AppShell showUpload={false} title="个人中心">
      <div className="mx-auto max-w-4xl space-y-4 animate-slide-up sm:space-y-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display text-lg sm:text-xl">账号信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">系统用户 ID</p>
                <p className="break-all font-mono text-sm font-medium">{displayId}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">邮箱</p>
                <p className="font-medium">{displayEmail}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">角色</p>
                <Badge variant="secondary">{roleLabel(displayRole as SessionUser["role"])}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">会员</p>
                <Badge variant={displayMembership === "free" ? "outline" : "vip"}>
                  {membershipLabel(displayMembership as SessionUser["membership"])}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">邮箱验证</p>
                <p className="font-medium">{displayVerified ? "已验证" : "未验证"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">会员到期</p>
                <p className="font-medium">
                  {displayExpires
                    ? format(new Date(displayExpires), "yyyy-MM-dd HH:mm")
                    : "—"}
                </p>
              </div>
            </div>

            <form onSubmit={saveProfile} className="space-y-4 border-t border-border pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">昵称</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                    required
                    placeholder="显示名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">用户名（用户 ID）</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    maxLength={24}
                    pattern="[a-zA-Z0-9_]{2,24}"
                    title="2–24 位字母、数字或下划线"
                    placeholder="例如 my_name"
                  />
                  <p className="text-xs text-muted-foreground">
                    可作为登录展示的用户 ID；2–24 位字母、数字或下划线，全局唯一
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="phone">绑定手机号</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="11 位中国大陆手机号，可留空解绑"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  保存资料
                </Button>
                {profileMsg && <p className="text-sm text-success">{profileMsg}</p>}
                {profileError && <p className="text-sm text-destructive">{profileError}</p>}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">苹果快捷指令 API Token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              用 Token 可以直接在快捷指令里「获取 URL 内容」，无需登录表单。
              每个文件都有独立链接：打开文件详情页，或在列表点「链接」一键复制。
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
