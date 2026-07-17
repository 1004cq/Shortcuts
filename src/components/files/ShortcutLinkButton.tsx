"use client";

import * as React from "react";
import { Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ShortcutLinkButtonProps = {
  fileId: string;
  className?: string;
  size?: "sm" | "default";
  label?: string;
};

/**
 * Fetches and copies the file-specific Shortcuts download URL.
 */
export function ShortcutLinkButton({
  fileId,
  className,
  size = "sm",
  label = "链接",
}: ShortcutLinkButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      const res = await fetch(`/api/files/${fileId}/shortcut`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "获取链接失败");
      const url = data.shortcutUrl || data.downloadUrl;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      alert(err instanceof Error ? err.message : "复制失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant="ghost"
      className={cn(className)}
      disabled={loading}
      onClick={onCopy}
      title="复制此文件的快捷指令链接"
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />}
      {copied ? "已复制" : label}
    </Button>
  );
}
