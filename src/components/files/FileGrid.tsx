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
        "group relative block overflow-hidden rounded-xl border border-border bg-card/50 p-4 transition-all duration-300",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-lg hover:shadow-primary/10"
      )}
    >
      <div className="mb-4 flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br from-muted to-muted/40">
        <Icon className="h-10 w-10 text-muted-foreground transition duration-300 group-hover:scale-110 group-hover:text-primary" />
        {isMedia && (
          <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg">
              {canAccessMedia ? <Play className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            </span>
          </span>
        )}
      </div>
      <div className="space-y-2">
        <p className="line-clamp-2 font-medium leading-snug group-hover:text-primary">{file.name}</p>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="font-normal">
            {file.category}
          </Badge>
          <span>{formatBytes(file.size)}</span>
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
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground">
        暂无文件
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {files.map((file) => (
        <FileCard key={file._id} file={file} canAccessMedia={canAccessMedia} />
      ))}
    </div>
  );
}
