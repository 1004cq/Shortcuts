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
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [previewingId, setPreviewingId] = React.useState<string | null>(null);
  const [previewError, setPreviewError] = React.useState("");

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

  // Scroll selected card inside the rail only — never scroll the page sideways
  React.useEffect(() => {
    const rail = railRef.current;
    if (!shortlink?.fileId || !rail) return;
    const el = rail.querySelector<HTMLElement>(
      `[data-audio-id="${shortlink.fileId}"]`
    );
    if (!el) return;
    const left = el.offsetLeft - (rail.clientWidth - el.offsetWidth) / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
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

  const stopPreview = () => {
    const el = previewAudioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    setPreviewingId(null);
  };

  const playPreview = async (fileId: string) => {
    setPreviewError("");
    try {
      stopPreview();
      const audio = previewAudioRef.current || new Audio();
      previewAudioRef.current = audio;
      audio.src = `/api/files/${fileId}/stream`;
      audio.preload = "auto";
      setPreviewingId(fileId);
      await audio.play();
    } catch {
      setPreviewingId(null);
      setPreviewError("试听失败，请检查网络或稍后重试");
    }
  };

  React.useEffect(() => {
    return () => stopPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      void playPreview(audio._id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "切换失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="我的短链接" showSearch={false} showUpload={false}>
      <div className="mx-auto w-full min-w-0 max-w-md space-y-4 overflow-x-hidden animate-slide-up sm:max-w-lg sm:space-y-5">
        {/* Shortlink */}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-sky-500/25 bg-gradient-to-b from-sky-500/15 via-sky-950/40 to-transparent p-4 sm:rounded-3xl sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-sky-200">
            <Link2 className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
            <h1 className="truncate font-display text-base font-semibold tracking-tight sm:text-lg">
              我的短链接
            </h1>
          </div>

          {loading ? (
            <div className="flex h-24 items-center justify-center text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载中…
            </div>
          ) : shortlink ? (
            <>
              <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-black/30 px-3 py-3 sm:rounded-2xl sm:px-4 sm:py-3.5">
                <p className="break-all font-mono text-[13px] font-semibold leading-snug text-sky-300 sm:text-sm">
                  {shortlink.shortUrl}
                </p>
                <p className="mt-1.5 truncate text-[11px] text-slate-400 sm:text-xs">
                  ID {shortlink.shortlinkUserId}
                  {" · "}剩余 {shortlink.remainingTimes}
                  {" · "}已用 {shortlink.usedTimes}
                </p>
              </div>

              <Button
                type="button"
                size="lg"
                className="mt-3 min-h-11 w-full gap-2 bg-sky-500 text-sm font-semibold text-slate-950 hover:bg-sky-400 sm:mt-4 sm:min-h-12 sm:text-base"
                onClick={() => void copyLink()}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "已复制" : "复制短链接"}
              </Button>

              <ol className="mt-3 space-y-1 text-[11px] leading-relaxed text-slate-400 sm:mt-4 sm:text-xs">
                <li>1. 快捷指令添加「获取 URL 内容」</li>
                <li>2. 粘贴上方短链接</li>
                <li>3. 再添加「播放声音」</li>
                <li>4. 下方切换音频后，快捷指令不用改</li>
              </ol>
            </>
          ) : (
            <p className="text-sm text-slate-400">短链接加载失败，请刷新。</p>
          )}
        </section>

        {/* Audio switcher */}
        <section className="min-w-0 space-y-2.5 overflow-hidden">
          <div className="flex min-w-0 items-end justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-display text-sm font-semibold text-slate-100 sm:text-base">
                切换音频
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
                左右滑动选择并自动试听，短链接不变
              </p>
            </div>
            {shortlink?.fileId && (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                已选
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="flex h-36 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载音频…
            </div>
          ) : audios.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-slate-500">
              暂无可用音频，请联系管理员上传
            </div>
          ) : (
            <>
              {/* Isolate horizontal scroll so it cannot widen the page */}
              <div className="relative -mx-3 min-w-0 overflow-hidden sm:mx-0">
                <div
                  ref={railRef}
                  className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain px-3 pb-1 touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-3 sm:px-0 [&::-webkit-scrollbar]:hidden"
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
                          "w-[78vw] max-w-[280px] shrink-0 snap-center rounded-2xl border p-4 text-left transition active:scale-[0.98] sm:w-[220px] sm:p-5",
                          active
                            ? "border-sky-400 bg-sky-500/20 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]"
                            : "border-white/10 bg-white/5"
                        )}
                      >
                        <div
                          className={cn(
                            "mb-3 flex h-11 w-11 items-center justify-center rounded-xl sm:h-12 sm:w-12 sm:rounded-2xl",
                            active
                              ? "bg-sky-400/25 text-sky-200"
                              : "bg-white/10 text-slate-300"
                          )}
                        >
                          <Music2 className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        <p className="line-clamp-2 break-words text-sm font-semibold leading-snug text-slate-100 sm:text-base">
                          {audio.name}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
                          {typeof audio.size === "number"
                            ? formatBytes(audio.size)
                            : "音频"}
                        </p>
                        {active && (
                          <span className="mt-2 inline-flex items-center gap-1 text-xs text-sky-300 sm:mt-3 sm:text-sm">
                            <Check className="h-3.5 w-3.5" />
                            当前播放
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {/* trailing spacer so last card can center */}
                  <div className="w-3 shrink-0 sm:w-0" aria-hidden />
                </div>
              </div>

              <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm sm:rounded-2xl sm:px-4 sm:py-3">
                <p className="text-[11px] text-slate-500">当前绑定</p>
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
                {previewingId && !saving && (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-sky-300">♪ 正在试听预览…</p>
                    <button
                      type="button"
                      className="text-xs text-slate-400 underline"
                      onClick={stopPreview}
                    >
                      停止
                    </button>
                  </div>
                )}
                {previewError && (
                  <p className="mt-1 text-xs text-amber-400">{previewError}</p>
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
