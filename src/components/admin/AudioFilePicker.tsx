"use client";

import * as React from "react";
import { Check, Loader2, Music2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, formatBytes } from "@/lib/utils";

export type AudioFileOption = {
  _id: string;
  name: string;
  originalName?: string;
  size?: number;
  mimeType?: string;
  category?: string;
};

type Props = {
  value: string | null;
  onChange: (file: AudioFileOption) => void;
  /** When true, show a horizontal snap carousel (mobile-friendly) */
  enableSwipe?: boolean;
  className?: string;
};

/**
 * Visual audio file picker — search + list + optional horizontal swipe cards.
 * Binds MediaVault audio files without typing fileId.
 */
export function AudioFilePicker({
  value,
  onChange,
  enableSwipe = true,
  className,
}: Props) {
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<AudioFileOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const railRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async (query = "") => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        category: "audio",
        limit: "100",
        sort: "newest",
      });
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/files?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载音频失败");
      setItems(
        (data.items || []).map(
          (f: {
            _id: string;
            name: string;
            originalName?: string;
            size?: number;
            mimeType?: string;
            category?: string;
          }) => ({
            _id: f._id,
            name: f.name,
            originalName: f.originalName,
            size: f.size,
            mimeType: f.mimeType,
            category: f.category,
          })
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载音频失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const t = window.setTimeout(() => load(q), 280);
    return () => window.clearTimeout(t);
  }, [q, load]);

  const selected = items.find((f) => f._id === value) || null;

  const scrollToId = (id: string) => {
    const el = railRef.current?.querySelector(`[data-file-id="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  React.useEffect(() => {
    if (value) scrollToId(value);
  }, [value, items]);

  return (
    <div className={cn("space-y-3", className)}>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索音频文件名…"
        className="bg-background/60"
      />

      {selected && (
        <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm">
          <span className="text-muted-foreground">已选：</span>
          <span className="font-medium text-foreground">{selected.name}</span>
        </div>
      )}

      {loading ? (
        <div className="flex h-28 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载音频中…
        </div>
      ) : error ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => load(q)}>
            重试
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          暂无音频文件，请先在「文件管理」上传
        </p>
      ) : (
        <>
          {enableSwipe && (
            <div
              ref={railRef}
              className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {items.map((f) => {
                const active = f._id === value;
                return (
                  <button
                    key={`card-${f._id}`}
                    type="button"
                    data-file-id={f._id}
                    onClick={() => onChange(f)}
                    className={cn(
                      "min-w-[78%] shrink-0 snap-center rounded-2xl border p-4 text-left transition sm:min-w-[220px]",
                      active
                        ? "border-sky-400 bg-sky-500/15 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]"
                        : "border-white/10 bg-white/5 hover:border-white/25"
                    )}
                  >
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400/30 to-violet-500/30">
                      <Music2 className="h-6 w-6 text-sky-300" />
                    </div>
                    <p className="line-clamp-2 text-sm font-semibold leading-snug">
                      {f.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {typeof f.size === "number" ? formatBytes(f.size) : "—"}
                    </p>
                    {active && (
                      <span className="mt-2 inline-flex items-center gap-1 text-xs text-sky-300">
                        <Check className="h-3.5 w-3.5" />
                        已选择
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-1">
            {items.map((f) => {
              const active = f._id === value;
              return (
                <button
                  key={`row-${f._id}`}
                  type="button"
                  onClick={() => onChange(f)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                    active
                      ? "bg-sky-500/20 text-foreground"
                      : "hover:bg-white/5"
                  )}
                >
                  <Music2
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-sky-300" : "text-muted-foreground"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {typeof f.size === "number" ? formatBytes(f.size) : ""}
                  </span>
                  {active && <Check className="h-4 w-4 shrink-0 text-sky-300" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
