"use client";

import Link from "next/link";
import {
  Film,
  Music,
  FileText,
  Image as ImageIcon,
  File,
  Download,
  Play,
  Lock,
} from "lucide-react";
import { format } from "date-fns";
import { formatBytes, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type FileTableProps = {
  files: FileItem[];
  canAccessMedia: boolean;
  onDownload?: (file: FileItem) => void;
  sort?: string;
  onSortChange?: (sort: string) => void;
};

export function FileTable({ files, canAccessMedia, onDownload, sort, onSortChange }: FileTableProps) {
  const SortBtn = ({ id, label }: { id: string; label: string }) => (
    <button
      type="button"
      className={cn("hover:text-foreground", sort === id && "text-primary")}
      onClick={() => onSortChange?.(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/60">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortBtn id="name" label="名称" />
            </TableHead>
            <TableHead>类型</TableHead>
            <TableHead>
              <SortBtn id="size" label="大小" />
            </TableHead>
            <TableHead>
              <SortBtn id="newest" label="上传时间" />
            </TableHead>
            <TableHead>
              <SortBtn id="downloads" label="下载" />
            </TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                暂无文件
              </TableCell>
            </TableRow>
          ) : (
            files.map((file) => {
              const Icon = categoryIcon[file.category] || File;
              return (
                <TableRow key={file._id} className="group">
                  <TableCell>
                    <Link
                      href={`/files/${file._id}`}
                      className="flex items-center gap-3 font-medium hover:text-primary"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition group-hover:bg-primary/15 group-hover:text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">{file.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {file.originalName}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{categoryLabel[file.category]}</Badge>
                  </TableCell>
                  <TableCell>{formatBytes(file.size)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {file.createdAt ? format(new Date(file.createdAt), "yyyy-MM-dd HH:mm") : "—"}
                  </TableCell>
                  <TableCell>{file.downloadCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {(file.category === "video" || file.category === "audio") && (
                        canAccessMedia ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/files/${file._id}`}>
                              <Play className="h-4 w-4" />
                              播放
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild size="sm" variant="ghost">
                            <Link href="/pricing">
                              <Lock className="h-4 w-4" />
                              VIP
                            </Link>
                          </Button>
                        )
                      )}
                      {canAccessMedia ? (
                        <Button size="sm" variant="ghost" onClick={() => onDownload?.(file)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button asChild size="sm" variant="ghost">
                          <Link href="/pricing">
                            <Lock className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
