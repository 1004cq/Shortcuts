"use client";

import * as React from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { GlassCard } from "@/components/admin/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Loader2, Radio } from "lucide-react";

export default function AdminRemotePlayPage() {
  const [userId, setUserId] = React.useState("");
  const [audioUrl, setAudioUrl] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [err, setErr] = React.useState("");

  const play = async () => {
    setLoading(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/admin/remote-play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId.trim(),
          audioUrl: audioUrl.trim(),
          title: title.trim() || "MediaVault Remote",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "推送失败");
      setMsg(
        `已推送 commandId=${data.commandId || "—"} · 在线接收端 ${data.receivers ?? "?"} 台`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "推送失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell title="远程音频">
      <div className="mx-auto max-w-2xl space-y-4">
        <GlassCard glow="cyan" className="p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-lg font-semibold">推送到 iPhone</p>
              <p className="text-xs text-muted-foreground">
                通过 Socket.io 实时服务推送播放指令（目标 1–3 秒）。接收端需在线。
              </p>
            </div>
            <Radio className="h-5 w-5 text-sky-300" />
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="uid">目标 userId</Label>
              <Input
                id="uid"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="与 iPhone 接收端一致"
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="url">音频 HTTPS URL</Label>
              <Input
                id="url"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="https://cq.imim.chat/api/files/.../stream?token=mv_..."
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">标题</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="可选"
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={play} disabled={loading || !userId || !audioUrl}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                播放到 iPhone
              </Button>
              <Button asChild type="button" variant="secondary">
                <a href="/realtime/" target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  打开 Socket 控制台
                </a>
              </Button>
              <Button asChild type="button" variant="ghost">
                <a href="/realtime/receiver.html" target="_blank" rel="noreferrer">
                  接收端页面
                </a>
              </Button>
            </div>
            {msg && <p className="text-sm text-emerald-300">{msg}</p>}
            {err && <p className="text-sm text-red-400">{err}</p>}
          </div>
        </GlassCard>

        <GlassCard className="p-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">快捷指令要点</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>iPhone 打开接收端并点「启动监听」解锁音频</li>
            <li>userId / AUTH_TOKEN 与控制台一致</li>
            <li>完整步骤见仓库 <code>remote-audio-push/README.md</code></li>
          </ol>
        </GlassCard>
      </div>
    </AdminShell>
  );
}
