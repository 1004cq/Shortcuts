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
import { roleLabel } from "@/lib/permissions";
import type { SessionUser } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, Copy, Loader2 } from "lucide-react";
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
  shortUrl?: string | null;
  shortlinkUserId?: string | null;
};

type ShortlinkData = {
  shortUrl: string;
  shortlinkUserId: string;
  remainingTimes: number;
  usedTimes: number;
  hasAudio: boolean;
};

export default function ProfilePage() {
  const { data, update } = useSession();
  const user = data?.user as SessionUser | undefined;

  const [logs, setLogs] = React.useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = React.useState(true);

  const [shortlink, setShortlink] = React.useState<ShortlinkData | null>(null);
  const [shortlinkLoading, setShortlinkLoading] = React.useState(true);
  const [copied, setCopied] = React.useState(false);

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
    if (item.shortUrl && item.shortlinkUserId) {
      setShortlink((prev) => ({
        shortUrl: item.shortUrl!,
        shortlinkUserId: item.shortlinkUserId!,
        remainingTimes: prev?.remainingTimes ?? 0,
        usedTimes: prev?.usedTimes ?? 0,
        hasAudio: prev?.hasAudio ?? false,
      }));
    }
  }, []);

  const loadShortlink = React.useCallback(async () => {
    setShortlinkLoading(true);
    try {
      const res = await fetch("/api/me/token");
      const data = await res.json();
      if (res.ok && data.shortUrl) {
        setShortlink({
          shortUrl: data.shortUrl,
          shortlinkUserId: data.shortlinkUserId,
          remainingTimes: data.remainingTimes ?? 0,
          usedTimes: data.usedTimes ?? 0,
          hasAudio: Boolean(data.hasAudio),
        });
      }
    } catch {
      // non-fatal
    } finally {
      setShortlinkLoading(false);
    }
  }, []);

  const loadProfile = React.useCallback(async () => {
    const res = await fetch("/api/me");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "加载资料失败");
    applyProfile(data.item as ProfileItem);
  }, [applyProfile]);

  React.useEffect(() => {
    (async () => {
      try {
        const [logsRes] = await Promise.all([
          fetch("/api/downloads?scope=me&limit=20"),
          loadProfile().catch(() => undefined),
          loadShortlink(),
        ]);
        const data = await logsRes.json();
        if (logsRes.ok) setLogs(data.items || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadProfile, loadShortlink]);

  const copyShortlink = async () => {
    if (!shortlink?.shortUrl) return;
    const ok = await copyToClipboard(shortlink.shortUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
      // Reload shortlink to reflect possible userId change
      await loadShortlink();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const displayId = profile?.id || user?.id || "—";
  const displayEmail = profile?.email || user?.email || "—";
  const displayRole = profile?.role || user?.role || "user";
  const displayVerified =
    profile?.emailVerified ?? user?.emailVerified ?? false;
  const displayExpires =
    profile?.membershipExpiresAt ?? user?.membershipExpiresAt ?? null;

  return (
    <AppShell showUpload={false} title="个人中心">
      <div className="mx-auto max-w-4xl space-y-4 animate-slide-up sm:space-y-6">
        {/* Account info + profile edit */}
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
                <p className="text-xs text-muted-foreground">账号类型</p>
                <Badge variant="outline">
                  {displayRole === "admin" ? "管理员" : "用户"}
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
                  <Label htmlFor="username">用户名（短链接 ID）</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    maxLength={24}
                    pattern="[a-zA-Z0-9_]{2,24}"
                    title="2–24 位字母、数字或下划线"
                    placeholder="例如 cq"
                  />
                  <p className="text-xs text-muted-foreground">
                    2–8 位纯字母数字的用户名会自动作为短链接 ID（如 cq → /api/cq）
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

        {/* Shortlink card */}
        <Card className="rounded-2xl border-sky-500/30 bg-sky-950/30">
          <CardHeader>
            <CardTitle className="font-display text-lg text-sky-200">
              苹果快捷指令链接
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {shortlinkLoading ? (
              <div className="flex h-16 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载中…
              </div>
            ) : shortlink ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 rounded-xl border border-sky-500/30 bg-sky-500/5 px-4 py-3">
                    <p className="break-all font-mono text-base font-semibold tracking-wide text-sky-300">
                      {shortlink.shortUrl}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      短链接 ID：{shortlink.shortlinkUserId}
                      {" · "}剩余 {shortlink.remainingTimes} 次
                      {" · "}已用 {shortlink.usedTimes} 次
                      {!shortlink.hasAudio && (
                        <span className="ml-2 text-amber-400">· 音频未绑定（联系管理员）</span>
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="lg"
                    className="min-h-12 shrink-0 gap-2 bg-sky-600 text-white hover:bg-sky-500 sm:min-w-[120px]"
                    onClick={() => void copyShortlink()}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copied ? "已复制" : "复制链接"}
                  </Button>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  <p className="mb-2 font-semibold text-slate-100">📱 在苹果快捷指令中使用</p>
                  <ol className="space-y-2 pl-1">
                    <li className="flex gap-2">
                      <span className="shrink-0 font-mono text-sky-400">1.</span>
                      新建快捷指令 → 添加动作「<strong className="text-white">获取 URL 内容</strong>」
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 font-mono text-sky-400">2.</span>
                      URL 填入上方短链接（点「复制链接」后粘贴）
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 font-mono text-sky-400">3.</span>
                      继续添加「<strong className="text-white">播放声音</strong>」动作
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 font-mono text-sky-400">4.</span>
                      后台更换音频后<strong className="text-white">无需修改快捷指令</strong>，短链接保持不变
                    </li>
                  </ol>
                  <p className="mt-3 text-xs text-slate-500">
                    · 修改用户名后短链接会自动同步（保存资料后立即生效）
                    <br />
                    · 次数不足时请联系管理员充值
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                短链接加载失败，请刷新页面重试。
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent downloads */}
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
