"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { copyToClipboard } from "@/lib/clipboard";
import { cn, formatBytes } from "@/lib/utils";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Link2,
  Loader2,
  Music2,
} from "lucide-react";

type ShortlinkInfo = {
  shortUrl: string;
  shortlinkUserId: string;
  fileId: string | null;
  fileName: string | null;
  remainingTimes: number;
  usedTimes: number;
  hasAudio: boolean;
};

type AudioItem = {
  _id: string;
  name: string;
  originalName?: string;
  size?: number;
  mimeType?: string;
};

export default function HomePage() {
  const { status } = useSession();
  const [shortlink, setShortlink] = React.useState<ShortlinkInfo | null>(null);
  const [audios, setAudios] = React.useState<AudioItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const railRef = React.useRef<HTMLDivElement>(null);

  const flash = (text: string) => {
    setMsg(text);
    window.setTimeout(() => setMsg(""), 2500);
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [slRes, filesRes] = await Promise.all([
        fetch("/api/me/shortlink"),
        fetch("/api/files?category=audio&limit=100&sort=newest"),
      ]);
      const slData = await slRes.json();
      const filesData = await filesRes.json();
      if (!slRes.ok) throw new Error(slData.error || "加载短链接失败");
      if (!filesRes.ok) throw new Error(filesData.error || "加载音频失败");
      setShortlink(slData.item as ShortlinkInfo);
      setAudios(
        (filesData.items || []).map(
          (f: {
            _id: string;
            name: string;
            originalName?: string;
            size?: number;
            mimeType?: string;
          }) => ({
            _id: f._id,
            name: f.name,
            originalName: f.originalName,
            size: f.size,
            mimeType: f.mimeType,
          })
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (status === "authenticated") void load();
  }, [status, load]);

  React.useEffect(() => {
    if (!shortlink?.fileId || !railRef.current) return;
    const el = railRef.current.querySelector(
      `[data-audio-id="${shortlink.fileId}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [shortlink?.fileId, audios]);

  const copyLink = async () => {
    if (!shortlink?.shortUrl) return;
    const ok = await copyToClipboard(shortlink.shortUrl);
    if (ok) {
      setCopied(true);
      flash("已复制短链接");
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      flash("请手动复制短链接");
    }
  };

  const selectAudio = async (audio: AudioItem) => {
    if (!shortlink || saving || audio._id === shortlink.fileId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/me/shortlink", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: audio._id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "切换失败");
      setShortlink(data.item as ShortlinkInfo);
      flash(`已切换：${audio.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "切换失败");
    } finally {
      setSaving(false);
    }
  };

  const scrollRail = (dir: -1 | 1) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.7), behavior: "smooth" });
  };

  const selected = audios.find((a) => a._id === shortlink?.fileId) || null;

  return (
    <AppShell
      title="我的短链接"
      showSearch={false}
      showUpload={false}
      contentClassName="px-3 sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5 pb-4 pt-1 animate-slide-up sm:max-w-xl sm:gap-6">
        {/* Shortlink */}
        <section className="rounded-3xl border border-sky-500/25 bg-gradient-to-b from-sky-500/15 via-sky-950/40 to-transparent p-5 shadow-[0_0_40px_-20px_rgba(56,189,248,0.45)] sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-sky-200">
            <Link2 className="h-5 w-5" />
            <h1 className="font-display text-lg font-semibold tracking-tight sm:text-xl">
              我的短链接
            </h1>
          </div>

          {loading ? (
            <div className="flex h-28 items-center justify-center text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载中…
            </div>
          ) : shortlink ? (
            <>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
                <p className="break-all font-mono text-base font-semibold leading-relaxed text-sky-300 sm:text-lg">
                  {shortlink.shortUrl}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  ID {shortlink.shortlinkUserId}
                  {" · "}剩余 {shortlink.remainingTimes}
                  {" · "}已用 {shortlink.usedTimes}
                </p>
              </div>

              <Button
                type="button"
                size="lg"
                className="mt-4 min-h-12 w-full gap-2 bg-sky-500 text-base font-semibold text-slate-950 hover:bg-sky-400"
                onClick={() => void copyLink()}
              >
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                {copied ? "已复制" : "复制短链接"}
              </Button>

              <ol className="mt-4 space-y-1.5 text-xs leading-relaxed text-slate-400 sm:text-[13px]">
                <li>1. 快捷指令添加「获取 URL 内容」</li>
                <li>2. 粘贴上方短链接</li>
                <li>3. 再添加「播放声音」</li>
                <li>4. 下方切换音频后，快捷指令不用改</li>
              </ol>
            </>
          ) : (
            <p className="text-sm text-slate-400">短链接加载失败，请下拉刷新。</p>
          )}
        </section>

        {/* Audio switcher */}
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-2 px-0.5">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-100 sm:text-lg">
                切换音频
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                左右滑动选择，短链接地址不变
              </p>
            </div>
            {selected && (
              <Badge variant="secondary" className="max-w-[40%] truncate">
                当前已选
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载音频…
            </div>
          ) : audios.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-slate-500">
              暂无可用音频，请联系管理员上传
            </div>
          ) : (
            <>
              <div className="relative">
                <button
                  type="button"
                  aria-label="上一个"
                  onClick={() => scrollRail(-1)}
                  className="absolute left-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-slate-950/80 text-slate-200 backdrop-blur sm:flex"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="下一个"
                  onClick={() => scrollRail(1)}
                  className="absolute right-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-slate-950/80 text-slate-200 backdrop-blur sm:flex"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                <div
                  ref={railRef}
                  className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {audios.map((audio) => {
                    const active = audio._id === shortlink?.fileId;
                    return (
                      <button
                        key={audio._id}
                        type="button"
                        data-audio-id={audio._id}
                        disabled={saving}
                        onClick={() => void selectAudio(audio)}
                        className={cn(
                          "min-w-[78%] shrink-0 snap-center rounded-3xl border p-5 text-left transition active:scale-[0.98] sm:min-w-[240px]",
                          active
                            ? "border-sky-400 bg-sky-500/20 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]"
                            : "border-white/10 bg-white/5 hover:border-white/25"
                        )}
                      >
                        <div
                          className={cn(
                            "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl",
                            active
                              ? "bg-sky-400/25 text-sky-200"
                              : "bg-white/10 text-slate-300"
                          )}
                        >
                          <Music2 className="h-7 w-7" />
                        </div>
                        <p className="line-clamp-2 text-base font-semibold leading-snug text-slate-100">
                          {audio.name}
                        </p>
                        <p className="mt-1.5 text-xs text-slate-500">
                          {typeof audio.size === "number"
                            ? formatBytes(audio.size)
                            : "音频"}
                        </p>
                        {active && (
                          <span className="mt-3 inline-flex items-center gap-1 text-sm text-sky-300">
                            <Check className="h-4 w-4" />
                            当前播放
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                <p className="text-xs text-slate-500">当前绑定</p>
                <p className="mt-0.5 truncate font-medium text-slate-100">
                  {shortlink?.fileName ||
                    (shortlink?.hasAudio ? "（文件缺失）" : "尚未选择音频")}
                </p>
                {saving && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-sky-300">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    切换中…
                  </p>
                )}
              </div>
            </>
          )}
        </section>

        {msg && (
          <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-center text-sm text-emerald-300">
            {msg}
          </p>
        )}
        {error && (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">
            {error}
          </p>
        )}
      </div>
    </AppShell>
  );
}
