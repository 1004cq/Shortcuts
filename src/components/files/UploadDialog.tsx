"use client";

import * as React from "react";
import { Upload, Loader2, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyToClipboard } from "@/lib/clipboard";

type UploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded?: () => void;
};

export function UploadDialog({ open, onOpenChange, onUploaded }: UploadDialogProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [name, setName] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [shortcutUrl, setShortcutUrl] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const reset = () => {
    setFile(null);
    setName("");
    setTags("");
    setDescription("");
    setError("");
    setShortcutUrl("");
    setCopied(false);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("请选择文件");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", name || file.name);
      form.append("tags", tags);
      form.append("description", description);
      const res = await fetch("/api/files", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "上传失败");
      const url = data.shortcutUrl || data.item?.shortcutUrl || "";
      setShortcutUrl(url);
      onUploaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>上传文件</DialogTitle>
          <DialogDescription>
            上传成功后会自动生成快捷指令专用链接。
          </DialogDescription>
        </DialogHeader>

        {shortcutUrl ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-success/40 bg-success/10 p-4">
              <p className="mb-2 text-sm font-semibold text-success">上传成功 · 链接已生成</p>
              <code className="block break-all rounded-md bg-background/80 p-2 font-mono text-[11px] leading-relaxed">
                {shortcutUrl}
              </code>
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={async () => {
                const ok = await copyToClipboard(shortcutUrl);
                setCopied(true);
                if (!ok) {
                  // prompt already shown
                }
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "已复制到剪贴板" : "复制快捷指令链接"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              完成
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">文件</Label>
              <Input
                id="file"
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setFile(f);
                  if (f && !name) setName(f.name.replace(/\.[^.]+$/, ""));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">显示名称</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">标签（逗号分隔）</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="电影, 4K"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {loading ? "上传中..." : "开始上传"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
