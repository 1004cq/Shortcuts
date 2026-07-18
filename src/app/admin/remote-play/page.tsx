"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Check,
  Copy,
  Loader2,
  Music2,
  Radio,
  RefreshCw,
  Square,
  Smartphone,
} from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { GlassCard } from "@/components/admin/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { copyToClipboard } from "@/lib/clipboard";
import { formatBytes } from "@/lib/utils";

type OnlineUser = {
  userId: string;
  deviceCount: number;
  devices?: Array<{ deviceId: string; lastSeen: number }>;
};

type UserRow = {
  _id: string;
  name: string;
  email: string;
  username?: string | null;
  phone?: string | null;
};

type AudioFile = {
  _id: string;
  name: string;
  originalName: string;
  size: number;
  mimeType: string;
  shareToken?: string;
};

export default function AdminRemotePlayPage() {
  const [bootLoading, setBootLoading] = React.useState(true);
  const [configured, setConfigured] = React.useState(false);
  const [serviceError, setServiceError] = React.useState("");
  const [online, setOnline] = React.useState<OnlineUser[]>([]);
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [audios, setAudios] = React.useState<AudioFile[]>([]);

  const [userId, setUserId] = React.useState("");
  const [customUserId, setCustomUserId] = React.useState("");
  const [fileId, setFileId] = React.useState("");
  const [audioUrl, setAudioUrl] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [useCustomUrl, setUseCustomUrl] = React.useState(false);

  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [err, setErr] = React.useState("");
  const [pollUrl, setPollUrl] = React.useState("");
  const [receiverUrl, setReceiverUrl] = React.useState("");
  const [copied, setCopied] = React.useState<"poll" | "rx" | "">("");

  const targetUserId = (customUserId.trim() || userId).trim();

  const loadBootstrap = React.useCallback(async () => {
    setBootLoading(true);
    setServiceError("");
    try {
      const [statusRes, usersRes, filesRes] = await Promise.all([
        fetch("/api/admin/remote-play"),
        fetch("/api/admin/users?limit=100"),
        fetch("/api/files?category=audio&limit=100&sort=newest"),
      ]);
      const status = await statusRes.json();
      const usersData = await usersRes.json();
      const filesData = await filesRes.json();

      if (!statusRes.ok) throw new Error(status.error || "状态加载失败");
      setConfigured(Boolean(status.configured));
      setServiceError(status.serviceError || "");
      setOnline(status.online || []);
      setUsers(usersData.items || []);
      setAudios(filesData.items || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setBootLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadBootstrap();
    const t = setInterval(() => {
      fetch("/api/admin/remote-play")
        .then((r) => r.json())
        .then((d) => {
          if (d.online) setOnline(d.online);
          if (d.serviceError !== undefined) setServiceError(d.serviceError || "");
        })
        .catch(() => undefined);
    }, 5000);
    return () => clearInterval(t);
  }, [loadBootstrap]);

  const selectedFile = audios.find((f) => f._id === fileId);

  const play = async () => {
    if (!targetUserId) {
      setErr("请选择或填写目标用户 ID");
      return;
    }
    if (!useCustomUrl && !fileId) {
      setErr("请选择音频文件");
      return;
    }
    if (useCustomUrl && !audioUrl.trim()) {
      setErr("请填写音频 URL");
      return;
    }
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/admin/remote-play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          useCustomUrl
            ? {
                action: "play",
                userId: targetUserId,
                audioUrl: audioUrl.trim(),
                title: title.trim() || "管理员推送",
              }
            : {
                action: "play",
                userId: targetUserId,
                fileId,
                title: title.trim() || selectedFile?.name || "管理员推送",
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "推送失败");
      setMsg(`已推送 commandId=${data.commandId || "—"}（快捷指令轮询中的手机会很快收到）`);
      void loadBootstrap();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "推送失败");
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (!targetUserId) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/remote-play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", userId: targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "停止失败");
      setMsg(`已发送停止 · ${data.commandId || ""}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "停止失败");
    } finally {
      setBusy(false);
    }
  };

  const genLink = async () => {
    if (!targetUserId) {
      setErr("请先选择/填写目标用户 ID");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/remote-play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "link", userId: targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成失败");
      setPollUrl(data.pollUrl || "");
      setReceiverUrl(data.receiverUrl || "");
      setMsg("已生成快捷指令轮询地址（推荐，不用开浏览器）");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "生成失败");
    } finally {
      setBusy(false);
    }
  };

  const copyText = async (text: string, kind: "poll" | "rx") => {
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(kind);
      setTimeout(() => setCopied(""), 1500);
    }
  };

  const pickOnline = (id: string) => {
    setUserId(id);
    setCustomUserId(id);
  };

  return (
    <AdminShell title="远程音频">
      <div className="mx-auto max-w-5xl space-y-4 xl:space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Admin Console
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              远程音频控制
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              全部集成在 /admin：本页控制推送，接收端为 /admin/rx（用户免登录）。
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => loadBootstrap()}>
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
        </div>

        {bootLoading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载后台数据…
          </div>
        ) : !configured ? (
          <GlassCard className="p-5 text-sm text-amber-200">
            未配置 <code>REMOTE_AUDIO_TOKEN</code>。请在服务器 `/opt/mediavault/.env` 与
            `/opt/remote-audio-push/.env` 中配置后重启服务。
          </GlassCard>
        ) : (
          <div className="grid gap-4 xl:grid-cols-5">
            <GlassCard glow="emerald" className="p-5 xl:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display font-semibold">在线 iPhone</p>
                <Badge variant="secondary" className="border border-white/10 bg-white/5">
                  {online.length} 用户
                </Badge>
              </div>
              {serviceError ? (
                <p className="text-sm text-amber-300">{serviceError}</p>
              ) : online.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  暂无网页在线端。用户用「快捷指令轮询」时这里可能为空，不影响播放。
                </p>
              ) : (
                <ul className="space-y-2">
                  {online.map((u) => (
                    <li key={u.userId}>
                      <button
                        type="button"
                        onClick={() => pickOnline(u.userId)}
                        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm transition hover:bg-white/10"
                      >
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          {u.userId}
                        </span>
                        <span className="text-xs text-muted-foreground">{u.deviceCount} 台</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>

            <GlassCard glow="cyan" className="space-y-4 p-5 xl:col-span-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">推送播放</p>
                  <p className="text-xs text-muted-foreground">选用户 + 选音频 → 立即播放</p>
                </div>
                <Radio className="h-5 w-5 text-sky-300" />
              </div>

              <div className="space-y-1.5">
                <Label>系统用户（可选）</Label>
                <select
                  value={userId}
                  onChange={(e) => {
                    setUserId(e.target.value);
                    const u = users.find((x) => x._id === e.target.value);
                    // Prefer username as remote room id when available
                    setCustomUserId(u?.username || u?._id || e.target.value);
                  }}
                  className="flex h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm"
                >
                  <option value="">手动填写下方 ID / 点左侧在线用户</option>
                  {users.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name}
                      {u.username ? ` (@${u.username})` : ""} · {u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="target">目标用户 ID（与 iPhone 接收端一致）</Label>
                <Input
                  id="target"
                  value={customUserId}
                  onChange={(e) => setCustomUserId(e.target.value)}
                  placeholder="例如 iphone_01 或用户名"
                  className="border-white/10 bg-black/20"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  id="customUrl"
                  type="checkbox"
                  checked={useCustomUrl}
                  onChange={(e) => setUseCustomUrl(e.target.checked)}
                />
                <label htmlFor="customUrl">使用自定义音频 URL（不选本站文件）</label>
              </div>

              {!useCustomUrl ? (
                <div className="space-y-1.5">
                  <Label>选择本站音频</Label>
                  <select
                    value={fileId}
                    onChange={(e) => {
                      setFileId(e.target.value);
                      const f = audios.find((x) => x._id === e.target.value);
                      if (f) setTitle(f.name);
                    }}
                    className="flex h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm"
                  >
                    <option value="">选择音频文件…</option>
                    {audios.map((f) => (
                      <option key={f._id} value={f._id}>
                        {f.name} · {formatBytes(f.size)}
                      </option>
                    ))}
                  </select>
                  {audios.length === 0 && (
                    <p className="text-xs text-amber-300">暂无音频文件，请先在「文件管理」上传</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="url">音频 HTTPS URL</Label>
                  <Input
                    id="url"
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                    placeholder="https://…"
                    className="border-white/10 bg-black/20"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="title">标题</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border-white/10 bg-black/20"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={play} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music2 className="h-4 w-4" />}
                  立即播放
                </Button>
                <Button type="button" variant="secondary" onClick={stop} disabled={busy || !targetUserId}>
                  <Square className="h-4 w-4" />
                  停止
                </Button>
                <Button type="button" variant="ghost" onClick={genLink} disabled={busy || !targetUserId}>
                  <Smartphone className="h-4 w-4" />
                  生成快捷指令配置
                </Button>
              </div>

              {msg && <p className="text-sm text-emerald-300">{msg}</p>}
              {err && <p className="text-sm text-red-400">{err}</p>}
            </GlassCard>
          </div>
        )}

        {pollUrl && (
          <GlassCard glow="violet" className="space-y-4 p-5">
            <div>
              <p className="font-display font-semibold">快捷指令轮询地址（推荐 · 不用开浏览器）</p>
              <p className="mt-1 text-xs text-muted-foreground">
                有推送时接口会直接返回音频文件（format=file）。捷径只需获取一次再播放，不要用「获取词典」。
              </p>
            </div>
            <code className="block break-all rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
              {pollUrl}
            </code>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => copyText(pollUrl, "poll")}
            >
              {copied === "poll" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === "poll" ? "已复制" : "复制轮询 URL"}
            </Button>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">iPhone 快捷指令（最简 · 3 个动作）</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5">
                <li>删掉旧捷径，重新新建（旧的 format=url 会失败）</li>
                <li>添加「<span className="text-foreground">重复</span>」→ 次数 <span className="text-foreground">999</span></li>
                <li>
                  重复内只加一个「<span className="text-foreground">获取 URL 内容</span>」→ 粘贴上方地址（须含{" "}
                  <span className="text-foreground">format=file</span>）
                </li>
                <li>
                  「<span className="text-foreground">如果</span>」：「URL 的内容」{" "}
                  <span className="text-foreground">有任何值</span>
                </li>
                <li>
                  如果里面只加「<span className="text-foreground">播放声音</span>」→ 声音文件选「URL 的内容」
                </li>
                <li>运行，保持屏幕亮着</li>
              </ol>
              <p className="mt-3 text-xs text-amber-200/90">
                不要「获取词典」，也不要第二个「获取 URL 内容」。空响应=暂时没播。锁屏后可能暂停。
              </p>
            </div>

            {receiverUrl && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">
                  备用：网页接收端（需开浏览器）
                </summary>
                <code className="mt-2 block break-all rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
                  {receiverUrl}
                </code>
                <Button
                  type="button"
                  size="sm"
                  className="mt-2"
                  variant="ghost"
                  onClick={() => copyText(receiverUrl, "rx")}
                >
                  {copied === "rx" ? "已复制" : "复制网页链接"}
                </Button>
              </details>
            )}
          </GlassCard>
        )}

        <GlassCard className="p-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">推荐用法</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>后台生成「快捷指令配置」→ 复制轮询 URL</li>
            <li>用户按上面步骤做捷径并运行（无需 Safari）</li>
            <li>管理员选音频 → 立即播放</li>
          </ol>
          {online[0]?.devices?.[0]?.lastSeen ? (
            <p className="mt-3 text-xs">
              网页在线（可选）：
              {format(new Date(online[0].devices[0].lastSeen), "HH:mm:ss")}
            </p>
          ) : null}
        </GlassCard>
      </div>
    </AdminShell>
  );
}
