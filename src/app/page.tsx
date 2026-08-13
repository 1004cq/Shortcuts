"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { LazyMediaThumb } from "@/components/media/LazyMediaThumb";
import {
  Check,
  Copy,
  Film,
  ImageIcon,
  Link2,
  Loader2,
  Music2,
  Search,
} from "lucide-react";

/** Shared easing — snappy but soft (~250–300ms). */
const GRID_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const GRID_DURATION = 0.28;

type MediaKind = "audio" | "video" | "image";
type FilterKind = "all" | MediaKind;

const FILTER_TABS: { id: FilterKind; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "audio", label: "音频" },
  { id: "video", label: "视频" },
  { id: "image", label: "图片" },
];

type ShortlinkInfo = {
  shortUrl: string;
  shortlinkUserId: string;
  fileId: string | null;
  fileName: string | null;
  category?: string | null;
  mimeType?: string | null;
  mediaKind?: MediaKind | null;
  remainingTimes: number;
  usedTimes: number;
  hasMedia?: boolean;
  hasAudio: boolean;
};

type MediaItem = {
  _id: string;
  name: string;
  originalName?: string;
  size?: number;
  mimeType?: string;
  category?: string;
  thumbnailPath?: string | null;
};

function thumbSrcFor(item: MediaItem): string | null {
  const kind = kindOf(item);
  if (kind === "image") return `/api/files/${item._id}/preview`;
  if (kind === "video" && item.thumbnailPath) {
    return `/api/files/${item._id}/preview`;
  }
  return null;
}

function kindOf(item: {
  category?: string | null;
  mimeType?: string | null;
  mediaKind?: MediaKind | null;
}): MediaKind {
  if (
    item.mediaKind === "video" ||
    item.mediaKind === "audio" ||
    item.mediaKind === "image"
  ) {
    return item.mediaKind;
  }
  const cat = String(item.category || "");
  const mime = String(item.mimeType || "");
  if (cat === "image" || mime.startsWith("image/")) return "image";
  if (cat === "video" || mime.startsWith("video/")) return "video";
  return "audio";
}

function kindLabel(kind: MediaKind): string {
  if (kind === "video") return "视频";
  if (kind === "image") return "图片";
  return "音频";
}

function KindIcon({
  kind,
  className,
}: {
  kind: MediaKind;
  className?: string;
}) {
  if (kind === "video") return <Film className={className} />;
  if (kind === "image") return <ImageIcon className={className} />;
  return <Music2 className={className} />;
}

/** Adaptive grid columns from total media count. */
function gridClassForCount(count: number): string {
  if (count <= 4) return "grid-cols-2 gap-3";
  if (count <= 9) return "grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3";
  return "grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 md:grid-cols-4 md:gap-3";
}

function cellClassForCount(
  count: number,
  active: boolean,
  previewing: boolean
): string {
  const size =
    count <= 4
      ? "min-h-[7.5rem] p-3.5 sm:min-h-[8.5rem] sm:p-4"
      : count <= 9
        ? "min-h-[5.75rem] p-2.5 sm:min-h-[6.25rem] sm:p-3"
        : "min-h-[5.25rem] p-2 sm:min-h-[5.5rem] sm:p-2.5";

  return cn(
    "flex flex-col items-center justify-center rounded-2xl border text-center",
    "transition-[border-color,background-color,box-shadow,color] duration-300 ease-out",
    size,
    active
      ? "border-sky-400 bg-sky-500/20 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]"
      : "border-white/10 bg-white/5 hover:border-white/25",
    previewing && "shadow-[0_0_0_2px_rgba(56,189,248,0.45)]"
  );
}

export default function HomePage() {
  const { status } = useSession();
  const reduceMotion = useReducedMotion();
  const motionDur = reduceMotion ? 0 : GRID_DURATION;
  const [shortlink, setShortlink] = React.useState<ShortlinkInfo | null>(null);
  const [medias, setMedias] = React.useState<MediaItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [query, setQuery] = React.useState("");
  /** Default「全部」— easy to scan mixed libraries; switch tabs to narrow. */
  const [filter, setFilter] = React.useState<FilterKind>("all");
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const previewVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const [previewingId, setPreviewingId] = React.useState<string | null>(null);
  const [previewKind, setPreviewKind] = React.useState<MediaKind | null>(null);
  const [previewError, setPreviewError] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement>(null);

  const itemTransition = React.useMemo(
    () => ({
      layout: { duration: motionDur, ease: GRID_EASE },
      opacity: { duration: motionDur * 0.85, ease: GRID_EASE },
      scale: { duration: motionDur * 0.85, ease: GRID_EASE },
    }),
    [motionDur]
  );

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
        fetch("/api/files?category=media&limit=100&sort=newest"),
      ]);
      const slData = await slRes.json();
      const filesData = await filesRes.json();
      if (!slRes.ok) throw new Error(slData.error || "加载短链接失败");
      if (!filesRes.ok) throw new Error(filesData.error || "加载媒体失败");
      setShortlink(slData.item as ShortlinkInfo);
      setMedias(
        (filesData.items || []).map(
          (f: {
            _id: string;
            name: string;
            originalName?: string;
            size?: number;
            mimeType?: string;
            category?: string;
            thumbnailPath?: string | null;
          }) => ({
            _id: f._id,
            name: f.name,
            originalName: f.originalName,
            size: f.size,
            mimeType: f.mimeType,
            category: f.category,
            thumbnailPath: f.thumbnailPath || null,
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

  const totalCount = medias.length;

  const kindCounts = React.useMemo(() => {
    const c = { all: medias.length, audio: 0, video: 0, image: 0 };
    for (const m of medias) {
      c[kindOf(m)] += 1;
    }
    return c;
  }, [medias]);

  /** Category scope first, then name search within that set. */
  const scoped = React.useMemo(() => {
    if (filter === "all") return medias;
    return medias.filter((m) => kindOf(m) === filter);
  }, [medias, filter]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((a) => {
      const name = (a.name || "").toLowerCase();
      const orig = (a.originalName || "").toLowerCase();
      const kind = kindOf(a);
      const label = kindLabel(kind);
      return (
        name.includes(q) ||
        orig.includes(q) ||
        kind.includes(q) ||
        label.includes(q)
      );
    });
  }, [scoped, query]);

  const scopeCount = scoped.length;
  const showDenseSearch = scopeCount >= 17 || totalCount >= 17;
  // Density follows current category scope (not search hits)
  const gridClass = gridClassForCount(scopeCount);

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
    const audio = previewAudioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    const video = previewVideoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    setPreviewingId(null);
    setPreviewKind(null);
  };

  const playPreview = async (item: MediaItem) => {
    setPreviewError("");
    const kind = kindOf(item);
    try {
      const audio = previewAudioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      const video = previewVideoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }

      setPreviewingId(item._id);
      setPreviewKind(kind);
      const src = `/api/files/${item._id}/stream`;

      if (kind === "video" || kind === "image") {
        // Video plays in effect; image just shows <img>
        return;
      }

      const player = previewAudioRef.current || new Audio();
      previewAudioRef.current = player;
      player.src = src;
      player.preload = "auto";
      await player.play();
    } catch {
      setPreviewingId(null);
      setPreviewKind(null);
      setPreviewError(
        kind === "video"
          ? "视频预览失败，请检查网络或稍后重试"
          : kind === "image"
            ? "图片预览失败，请检查网络或稍后重试"
            : "试听失败，请检查网络或稍后重试"
      );
    }
  };

  React.useEffect(() => {
    if (previewKind !== "video" || !previewingId) return;
    const el = previewVideoRef.current;
    if (!el) return;
    el.src = `/api/files/${previewingId}/stream`;
    void el.play().catch(() => {
      setPreviewError("视频预览失败，请检查网络或稍后重试");
      setPreviewingId(null);
      setPreviewKind(null);
    });
  }, [previewKind, previewingId]);

  React.useEffect(() => {
    return () => stopPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectMedia = async (item: MediaItem) => {
    if (!shortlink || saving) return;
    if (item._id === shortlink.fileId) {
      void playPreview(item);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/me/shortlink", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: item._id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "切换失败");
      setShortlink(data.item as ShortlinkInfo);
      flash(`已切换：${item.name}`);
      void playPreview(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "切换失败");
    } finally {
      setSaving(false);
    }
  };

  const boundKind = shortlink ? kindOf(shortlink) : "audio";
  const hasBound = Boolean(shortlink?.fileId || shortlink?.hasMedia || shortlink?.hasAudio);

  return (
    <AppShell title="我的短链接" showSearch={false} showUpload={false}>
      <div className="mx-auto w-full min-w-0 max-w-md space-y-4 overflow-x-hidden animate-slide-up sm:max-w-xl sm:space-y-5">
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
                <li>3. 音频用「播放声音」（不弹窗）；视频/图片用「快速查看」</li>
                <li>4. 同一短链接可切换音频/视频/图片，切换后不用改快捷指令</li>
              </ol>
            </>
          ) : (
            <p className="text-sm text-slate-400">短链接加载失败，请刷新。</p>
          )}
        </section>

        <section className="min-w-0 space-y-2.5">
          <div className="flex min-w-0 items-end justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-display text-sm font-semibold text-slate-100 sm:text-base">
                切换媒体
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
                点选即可切换并预览，短链接不变
                {totalCount > 0
                  ? ` · ${filter === "all" ? `共 ${totalCount}` : `${kindLabel(filter)} ${scopeCount}/${totalCount}`} 个`
                  : ""}
              </p>
            </div>
            {shortlink?.fileId && (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {kindLabel(boundKind)}
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="flex h-36 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载媒体…
            </div>
          ) : medias.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-slate-500">
              暂无可用音频/视频/图片，请联系管理员上传
            </div>
          ) : (
            <>
              <div
                className="grid grid-cols-4 gap-1 rounded-xl border border-white/10 bg-black/25 p-1"
                role="tablist"
                aria-label="媒体分类"
              >
                {FILTER_TABS.map((tab) => {
                  const active = filter === tab.id;
                  const count = kindCounts[tab.id];
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilter(tab.id)}
                      className={cn(
                        "flex min-h-10 flex-col items-center justify-center rounded-lg px-1 py-1.5 text-center transition",
                        active
                          ? tab.id === "video"
                            ? "bg-violet-500/25 text-violet-100 shadow-sm"
                            : tab.id === "image"
                              ? "bg-emerald-500/25 text-emerald-100 shadow-sm"
                              : tab.id === "audio"
                                ? "bg-sky-500/25 text-sky-100 shadow-sm"
                                : "bg-white/15 text-slate-50 shadow-sm"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      )}
                    >
                      <span className="text-[11px] font-semibold sm:text-xs">
                        {tab.label}
                      </span>
                      <span className="text-[10px] tabular-nums opacity-80">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                className={cn(
                  "relative",
                  showDenseSearch && "rounded-xl border border-sky-500/30 bg-sky-500/5 p-1"
                )}
              >
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    filter === "all"
                      ? showDenseSearch
                        ? "在全部中搜索名称…"
                        : "搜索名称…"
                      : `在${kindLabel(filter)}中搜索…`
                  }
                  className="h-11 border-white/10 bg-black/25 pl-9 text-sm"
                  autoFocus={showDenseSearch}
                />
              </div>

              <div
                className={cn(
                  "min-w-0",
                  showDenseSearch &&
                    "max-h-[min(52vh,28rem)] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-black/10 p-2 sm:max-h-[32rem]"
                )}
              >
                <LayoutGroup id="media-switch-grid">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {filtered.length === 0 ? (
                      <motion.p
                        key="empty"
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: motionDur }}
                        className="py-8 text-center text-sm text-slate-500"
                      >
                        没有匹配
                        {query.trim()
                          ? `「${query.trim()}」`
                          : filter === "all"
                            ? ""
                            : `「${kindLabel(filter)}」`}
                        的媒体
                        {filter !== "all" && query.trim()
                          ? `（当前：${kindLabel(filter)}）`
                          : ""}
                      </motion.p>
                    ) : (
                      <motion.div
                        key="grid"
                        layout
                        transition={{ layout: { duration: motionDur, ease: GRID_EASE } }}
                        className={cn("grid", gridClass)}
                      >
                        <AnimatePresence mode="popLayout" initial={false}>
                          {filtered.map((item) => {
                            const active = item._id === shortlink?.fileId;
                            const previewing = previewingId === item._id;
                            const kind = kindOf(item);
                            const thumbSrc = thumbSrcFor(item);
                            const iconSize =
                              scopeCount <= 4
                                ? "h-6 w-6"
                                : "h-4 w-4 sm:h-5 sm:w-5";
                            return (
                              <motion.button
                                key={item._id}
                                type="button"
                                layout={scopeCount >= 17 ? "position" : true}
                                disabled={saving}
                                onClick={() => void selectMedia(item)}
                                className={cellClassForCount(
                                  scopeCount,
                                  active,
                                  previewing
                                )}
                                title={item.name}
                                initial={
                                  reduceMotion
                                    ? false
                                    : { opacity: 0, scale: 0.92 }
                                }
                                animate={{ opacity: 1, scale: 1 }}
                                exit={
                                  reduceMotion
                                    ? { opacity: 0 }
                                    : { opacity: 0, scale: 0.9 }
                                }
                                whileTap={
                                  reduceMotion ? undefined : { scale: 0.96 }
                                }
                                transition={itemTransition}
                              >
                                <span
                                  className={cn(
                                    "mb-1 rounded px-1 py-px text-[9px] font-semibold sm:text-[10px]",
                                    kind === "video"
                                      ? "bg-violet-500/25 text-violet-200"
                                      : kind === "image"
                                        ? "bg-emerald-500/25 text-emerald-200"
                                        : "bg-sky-500/25 text-sky-200"
                                  )}
                                >
                                  {kindLabel(kind)}
                                </span>
                                {thumbSrc ? (
                                  <LazyMediaThumb
                                    src={thumbSrc}
                                    alt={item.name}
                                    rootMargin="280px 0px"
                                    className={cn(
                                      "mb-1.5 rounded-xl",
                                      scopeCount <= 4
                                        ? "h-14 w-14 sm:h-16 sm:w-16"
                                        : "h-11 w-11 sm:h-12 sm:w-12"
                                    )}
                                    fallback={
                                      <KindIcon
                                        kind={kind}
                                        className={cn(
                                          iconSize,
                                          kind === "image"
                                            ? "text-emerald-300"
                                            : "text-violet-300"
                                        )}
                                      />
                                    }
                                  />
                                ) : (
                                  <div
                                    className={cn(
                                      "mb-1.5 flex items-center justify-center rounded-xl transition-colors duration-300",
                                      scopeCount <= 4
                                        ? "h-12 w-12 sm:h-14 sm:w-14"
                                        : "h-9 w-9 sm:h-10 sm:w-10",
                                      active
                                        ? kind === "video"
                                          ? "bg-violet-400/25 text-violet-200"
                                          : kind === "image"
                                            ? "bg-emerald-400/25 text-emerald-200"
                                            : "bg-sky-400/25 text-sky-200"
                                        : "bg-white/10 text-slate-300"
                                    )}
                                  >
                                    <KindIcon
                                      kind={kind}
                                      className={cn(
                                        "transition-transform duration-300",
                                        iconSize,
                                        previewing && "animate-pulse scale-110"
                                      )}
                                    />
                                  </div>
                                )}
                                <p
                                  className={cn(
                                    "w-full break-words font-medium leading-snug text-slate-100",
                                    scopeCount <= 4
                                      ? "line-clamp-2 text-sm sm:text-base"
                                      : "line-clamp-2 text-[11px] sm:text-xs"
                                  )}
                                >
                                  {item.name}
                                </p>
                                <AnimatePresence initial={false}>
                                  {active && (
                                    <motion.span
                                      key="active-label"
                                      initial={
                                        reduceMotion
                                          ? false
                                          : { opacity: 0, y: 4 }
                                      }
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -2 }}
                                      transition={{ duration: motionDur * 0.8 }}
                                      className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-sky-300 sm:text-xs"
                                    >
                                      <Check className="h-3 w-3" />
                                      {previewing
                                        ? kind === "audio"
                                          ? "试听中"
                                          : "预览中"
                                        : "当前"}
                                    </motion.span>
                                  )}
                                </AnimatePresence>
                              </motion.button>
                            );
                          })}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </LayoutGroup>
              </div>

              <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm sm:rounded-2xl sm:px-4 sm:py-3">
                <p className="text-[11px] text-slate-500">当前绑定</p>
                <p className="mt-0.5 truncate font-medium text-slate-100">
                  {shortlink?.fileName ||
                    (hasBound ? "（文件缺失）" : "尚未选择音频/视频/图片")}
                </p>
                {shortlink?.fileId && (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    类型：{kindLabel(boundKind)}
                  </p>
                )}
                {saving && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-sky-300">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    切换中…
                  </p>
                )}
                {previewKind === "video" && previewingId && !saving && (
                  <div className="mt-2 space-y-2">
                    <video
                      ref={previewVideoRef}
                      controls
                      playsInline
                      className="max-h-48 w-full rounded-lg bg-black"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-violet-300">正在预览视频…</p>
                      <button
                        type="button"
                        className="text-xs text-slate-400 underline"
                        onClick={stopPreview}
                      >
                        停止
                      </button>
                    </div>
                  </div>
                )}
                {previewKind === "image" && previewingId && !saving && (
                  <div className="mt-2 space-y-2">
                    <LazyMediaThumb
                      priority
                      src={`/api/files/${previewingId}/preview`}
                      alt={shortlink?.fileName || "图片预览"}
                      className="max-h-48 min-h-[8rem] w-full rounded-lg bg-black/40"
                      imgClassName="object-contain"
                      fallback={
                        <ImageIcon className="h-8 w-8 text-emerald-300/80" />
                      }
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-emerald-300">正在预览图片…</p>
                      <button
                        type="button"
                        className="text-xs text-slate-400 underline"
                        onClick={stopPreview}
                      >
                        关闭
                      </button>
                    </div>
                  </div>
                )}
                {previewKind === "audio" && previewingId && !saving && (
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
