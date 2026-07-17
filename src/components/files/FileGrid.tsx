"use client";

import Link from "next/link";
import { Film, Music, FileText, Image as ImageIcon, File, Lock, Play } from "lucide-react";
import { formatBytes, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { FileCategory, FileItem } from "@/types";

const categoryIcon: Record<FileCategory, React.ComponentType<{ className?: string }>> = {
  video: Film,
  audio: Music,
  document: FileText,
  image: ImageIcon,
  other: File,
};

const categoryLabel: Record<FileCategory, string> = {
  video: "视频",
  audio: "音频",
  document: "文档",
  image: "图片",
  other: "其他",
};

type FileCardProps = {
  file: FileItem;
  canAccessMedia: boolean;
};

export function FileCard({ file, canAccessMedia }: FileCardProps) {
  const Icon = categoryIcon[file.category] || File;
  const isMedia = file.category === "video" || file.category === "audio";

  return (
    <Link
      href={`/files/${file._id}`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border border-border/70 bg-card/60 transition-all duration-300",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-lg hover:shadow-primary/10"
      )}
    >
      <div className="relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-muted via-muted/50 to-background sm:aspect-video">
        <Icon className="h-8 w-8 text-muted-foreground transition duration-300 group-hover:scale-110 group-hover:text-primary sm:h-10 sm:w-10" />
        {isMedia && (
          <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg sm:h-12 sm:w-12">
              {canAccessMedia ? <Play className="h-4 w-4 sm:h-5 sm:w-5" /> : <Lock className="h-4 w-4 sm:h-5 sm:w-5" />}
            </span>
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-2.5 sm:space-y-2 sm:p-4">
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug group-hover:text-primary sm:text-base">
          {file.name}
        </p>
        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground sm:text-xs">
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal sm:px-2 sm:text-xs">
            {categoryLabel[file.category]}
          </Badge>
          <span className="truncate">{formatBytes(file.size)}</span>
        </div>
      </div>
    </Link>
  );
}

export function FileGrid({
  files,
  canAccessMedia,
}: {
  files: FileItem[];
  canAccessMedia: boolean;
}) {
  if (files.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border text-muted-foreground">
        暂无文件
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {files.map((file) => (
        <FileCard key={file._id} file={file} canAccessMedia={canAccessMedia} />
      ))}
    </div>
  );
}
