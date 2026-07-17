"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
  Download,
  Lock,
  Loader2,
  Crown,
  Film,
  Music,
  FileText,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Breadcrumbs } from "@/components/files/Breadcrumbs";
import { VideoPlayer } from "@/components/files/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";
import { canDownload, canStream } from "@/lib/permissions";
import type { FileItem, SessionUser } from "@/types";

export default function FileDetailPage() {
  const params = useParams<{ id: string }>();
  const { data } = useSession();
  const user = data?.user as SessionUser | undefined;
  const [file, setFile] = React.useState<FileItem | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const allowedDownload = canDownload(user);
  const allowedStream = canStream(user);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/files/${params.id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "加载失败");
        if (!cancelled) setFile(data.item);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (loading) {
    return (
      <AppShell showSearch={false} hideMobileTabBar>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      </AppShell>
    );
  }

  if (error || !file) {
    return (
      <AppShell showSearch={false}>
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
          {error || "文件不存在"}
        </div>
      </AppShell>
    );
  }

  const isVideo = file.category === "video";
  const isAudio = file.category === "audio";
  const streamUrl = `/api/files/${file._id}/stream`;

  return (
    <AppShell showSearch={false} showUpload={false} hideMobileTabBar={isVideo}>
      <div className="animate-fade-in">
        <Breadcrumbs items={[{ label: "文件", href: "/" }, { label: file.name }]} />

        {/* Immersive player layout for video */}
        {isVideo ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="min-w-0">
              {allowedStream ? (
                <VideoPlayer src={streamUrl} type={file.mimeType} />
              ) : (
                <VipGate kind="播放视频" />
              )}
            </div>
            <aside className="space-y-4 rounded-xl border border-border bg-card/60 p-5 lg:sticky lg:top-24 lg:self-start">
              <FileMeta file={file} />
              <Actions
                file={file}
                allowedDownload={allowedDownload}
              />
            </aside>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="rounded-xl border border-border bg-card/60 p-6">
              <div className="mb-6 flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  {isAudio ? <Music className="h-7 w-7" /> : <FileText className="h-7 w-7" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-2xl font-bold">{file.name}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">{file.originalName}</p>
                </div>
              </div>

              {isAudio && (
                allowedStream ? (
                  <audio controls className="mb-6 w-full" src={streamUrl} preload="metadata">
                    您的浏览器不支持音频播放
                  </audio>
                ) : (
                  <div className="mb-6">
                    <VipGate kind="播放音频" />
                  </div>
                )
              )}

              <FileMeta file={file} />
              <div className="mt-6">
                <Actions file={file} allowedDownload={allowedDownload} />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function FileMeta({ file }: { file: FileItem }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{file.category}</Badge>
        {file.tags?.map((t) => (
          <Badge key={t} variant="secondary">
            {t}
          </Badge>
        ))}
      </div>
      {file.description && <p className="text-muted-foreground">{file.description}</p>}
      <dl className="grid grid-cols-2 gap-3 text-muted-foreground">
        <div>
          <dt className="text-xs uppercase tracking-wide">大小</dt>
          <dd className="text-foreground">{formatBytes(file.size)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide">下载次数</dt>
          <dd className="text-foreground">{file.downloadCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide">类型</dt>
          <dd className="truncate text-foreground">{file.mimeType}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide">上传时间</dt>
          <dd className="text-foreground">
            {file.createdAt ? format(new Date(file.createdAt), "yyyy-MM-dd HH:mm") : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Actions({
  file,
  allowedDownload,
}: {
  file: FileItem;
  allowedDownload: boolean;
}) {
  const [shortcutUrl, setShortcutUrl] = React.useState("");
  const [downloadUrl, setDownloadUrl] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [linkError, setLinkError] = React.useState("");

  React.useEffect(() => {
    if (!allowedDownload) return;
    (async () => {
      try {
        const res = await fetch(`/api/files/${file._id}/shortcut`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "获取链接失败");
        setShortcutUrl(data.shortcutUrl || "");
        setDownloadUrl(data.downloadUrl || "");
      } catch (err) {
        setLinkError(err instanceof Error ? err.message : "获取链接失败");
      }
    })();
  }, [allowedDownload, file._id]);

  if (!allowedDownload) {
    return (
      <Button className="w-full" asChild>
        <Link href="/pricing">
          <Lock className="h-4 w-4" />
          升级后下载
        </Link>
      </Button>
    );
  }

  const displayUrl = shortcutUrl || downloadUrl;

  return (
    <div className="space-y-3">
      <Button className="w-full" asChild>
        <a href={`/api/files/${file._id}/download`}>
          <Download className="h-4 w-4" />
          下载文件
        </a>
      </Button>

      <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <p className="text-sm font-semibold text-foreground">此文件的快捷指令链接</p>
        <p className="text-xs text-muted-foreground">
          每个文件都有独立链接，粘贴到「获取 URL 内容」即可
        </p>
        {displayUrl ? (
          <>
            <code className="block max-h-24 overflow-y-auto break-all rounded-md bg-background/80 p-2 font-mono text-[11px] leading-relaxed">
              {displayUrl}
            </code>
            <Button
              type="button"
              className="w-full"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(displayUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "已复制" : "复制此文件链接"}
            </Button>
          </>
        ) : linkError ? (
          <p className="text-sm text-destructive">{linkError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">正在生成链接…</p>
        )}
      </div>
    </div>
  );
}

function VipGate({ kind }: { kind: string }) {
  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Film className="h-7 w-7" />
      </div>
      <div>
        <p className="font-display text-lg font-semibold">需要 VIP 才能{kind}</p>
        <p className="mt-1 text-sm text-muted-foreground">免费用户可浏览列表，升级解锁流媒体与下载</p>
      </div>
      <Button asChild>
        <Link href="/pricing">
          <Crown className="h-4 w-4" />
          查看会员套餐
        </Link>
      </Button>
    </div>
  );
}
