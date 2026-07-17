"use client";

import * as React from "react";
import { Link2, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboard";

type ShortcutLinkButtonProps = {
  fileId: string;
  shortcutUrl?: string | null;
  className?: string;
  size?: "sm" | "default";
  label?: string;
};

/**
 * Copies the file-specific permanent Shortcuts URL.
 * Uses HTTP-safe clipboard helper (site is served over http://IP).
 */
export function ShortcutLinkButton({
  fileId,
  shortcutUrl,
  className,
  size = "sm",
  label = "链接",
}: ShortcutLinkButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      let url = (shortcutUrl || "").trim();
      if (!url) {
        const res = await fetch(`/api/files/${fileId}/shortcut`, {
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "获取链接失败");
        url = String(data.shortcutUrl || data.downloadUrl || "").trim();
      }
      if (!url) throw new Error("链接为空");

      const ok = await copyToClipboard(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (!ok) {
        // prompt already shown by helper
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "复制失败，请打开文件详情页手动复制");
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
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : copied ? (
        <Check className="h-4 w-4 text-success" />
      ) : (
        <Link2 className="h-4 w-4" />
      )}
      {loading ? "…" : copied ? "已复制" : label}
    </Button>
  );
}
