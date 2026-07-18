"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/AppShell";
import { Breadcrumbs } from "@/components/files/Breadcrumbs";
import { FileTable } from "@/components/files/FileTable";
import { FileGrid } from "@/components/files/FileGrid";
import { Button } from "@/components/ui/button";
import { canDownload } from "@/lib/permissions";
import type { FileItem, SessionUser } from "@/types";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const categoryLabels: Record<string, string> = {
  all: "全部",
  video: "视频",
  audio: "音频",
  document: "文档",
  image: "图片",
  other: "其他",
};

const categories = ["all", "video", "audio", "document", "image", "other"] as const;

function useIsMobile() {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

function HomePageInner() {
  const { data } = useSession();
  const user = data?.user as SessionUser | undefined;
  const searchParams = useSearchParams();
  const router = useRouter();
  const isMobile = useIsMobile();

  const [viewMode, setViewMode] = React.useState<"list" | "grid">("list");
  const [viewReady, setViewReady] = React.useState(false);
  const [files, setFiles] = React.useState<FileItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [total, setTotal] = React.useState(0);

  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "all";
  const sort = searchParams.get("sort") || "newest";
  const page = searchParams.get("page") || "1";

  const canAccess = canDownload(user);

  // Default to grid on phones for denser browsing
  React.useEffect(() => {
    if (viewReady) return;
    setViewMode(isMobile ? "grid" : "list");
    setViewReady(true);
  }, [isMobile, viewReady]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ sort, page, limit: "24" });
        if (q) params.set("q", q);
        if (category !== "all") params.set("category", category);
        const res = await fetch(`/api/files?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "加载失败");
        if (!cancelled) {
          setFiles(data.items || []);
          setTotal(data.pagination?.total || 0);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, category, sort, page]);

  const setSort = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", next);
    router.push(`/?${params.toString()}`);
  };

  const setCategory = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("category");
    else params.set("category", next);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  };

  const onDownload = (file: FileItem) => {
    window.location.href = `/api/files/${file._id}/download`;
  };

  return (
    <AppShell viewMode={viewMode} onViewModeChange={setViewMode}>
      <div className="animate-slide-up">
        <Breadcrumbs
          items={[
            ...(category !== "all"
              ? [{ label: categoryLabels[category] || category }]
              : [{ label: "全部文件" }]),
          ]}
        />

        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">
              {category !== "all" ? categoryLabels[category] : "全部文件"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              共 {total} 个文件
              {!canAccess && " · 免费用户可浏览，升级 VIP 即可下载与播放"}
            </p>
          </div>
          {!canAccess && (
            <Button asChild size="sm" className="sm:h-10 sm:px-4 sm:text-sm">
              <a href="/pricing">升级 VIP</a>
            </Button>
          )}
        </div>

        {/* Category chips — horizontal scroll on mobile */}
        <div className="mb-4 -mx-1 overflow-x-auto no-scrollbar sm:mb-5">
          <div className="flex w-max gap-2 px-1 pb-1">
            {categories.map((key) => {
              const active = category === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium transition sm:text-sm",
                    active
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border/80 bg-card/50 text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  {categoryLabels[key]}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
            {error}
          </div>
        ) : viewMode === "list" ? (
          <FileTable
            files={files}
            canAccessMedia={canAccess}
            onDownload={onDownload}
            sort={sort}
            onSortChange={setSort}
          />
        ) : (
          <FileGrid files={files} canAccessMedia={canAccess} />
        )}
      </div>
    </AppShell>
  );
}

export default function HomePage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <HomePageInner />
    </React.Suspense>
  );
}
