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
import { ShortcutLinkButton } from "@/components/files/ShortcutLinkButton";
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

  if (files.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border text-muted-foreground">
        暂无文件
      </div>
    );
  }

  return (
    <>
      {/* Mobile card list */}
      <div className="space-y-2 md:hidden">
        {files.map((file) => {
          const Icon = categoryIcon[file.category] || File;
          const isMedia = file.category === "video" || file.category === "audio";
          return (
            <div
              key={file._id}
              className="rounded-2xl border border-border/70 bg-card/70 p-3 shadow-sm"
            >
              <Link href={`/files/${file._id}`} className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium leading-snug">{file.name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {categoryLabel[file.category]}
                    </Badge>
                    <span>{formatBytes(file.size)}</span>
                    <span>
                      {file.createdAt ? format(new Date(file.createdAt), "MM-dd") : "—"}
                    </span>
                  </span>
                </span>
              </Link>
              <div className="mt-2.5 flex items-center justify-end gap-1 border-t border-border/60 pt-2">
                {isMedia &&
                  (canAccessMedia ? (
                    <Button asChild size="sm" variant="ghost" className="h-8 px-2.5">
                      <Link href={`/files/${file._id}`}>
                        <Play className="h-4 w-4" />
                        播放
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="ghost" className="h-8 px-2.5">
                      <Link href="/pricing">
                        <Lock className="h-4 w-4" />
                        VIP
                      </Link>
                    </Button>
                  ))}
                {canAccessMedia ? (
                  <>
                    <ShortcutLinkButton fileId={file._id} shortcutUrl={file.shortcutUrl} />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2.5"
                      onClick={() => onDownload?.(file)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button asChild size="sm" variant="ghost" className="h-8 px-2.5">
                    <Link href="/pricing">
                      <Lock className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border/70 bg-card/60 md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortBtn id="name" label="名称" />
                </TableHead>
                <TableHead className="hidden lg:table-cell">类型</TableHead>
                <TableHead>
                  <SortBtn id="size" label="大小" />
                </TableHead>
                <TableHead className="hidden xl:table-cell">
                  <SortBtn id="newest" label="上传时间" />
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  <SortBtn id="downloads" label="下载" />
                </TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => {
                const Icon = categoryIcon[file.category] || File;
                return (
                  <TableRow key={file._id} className="group">
                    <TableCell>
                      <Link
                        href={`/files/${file._id}`}
                        className="flex items-center gap-3 font-medium hover:text-primary"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition group-hover:bg-primary/15 group-hover:text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block max-w-[14rem] truncate lg:max-w-xs xl:max-w-md">
                            {file.name}
                          </span>
                          <span className="block max-w-[14rem] truncate text-xs text-muted-foreground lg:max-w-xs">
                            {file.originalName}
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline">{categoryLabel[file.category]}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatBytes(file.size)}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground xl:table-cell">
                      {file.createdAt
                        ? format(new Date(file.createdAt), "yyyy-MM-dd HH:mm")
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{file.downloadCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {(file.category === "video" || file.category === "audio") &&
                          (canAccessMedia ? (
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
                          ))}
                        {canAccessMedia ? (
                          <>
                            <ShortcutLinkButton
                              fileId={file._id}
                              shortcutUrl={file.shortcutUrl}
                            />
                            <Button size="sm" variant="ghost" onClick={() => onDownload?.(file)}>
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
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
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
