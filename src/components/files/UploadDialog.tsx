"use client";

import * as React from "react";
import { Upload, Loader2, Copy, Check, Mic, FileUp } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { VoiceRecorder } from "@/components/files/VoiceRecorder";

type UploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded?: () => void;
};

type SourceMode = "file" | "record";

export function UploadDialog({ open, onOpenChange, onUploaded }: UploadDialogProps) {
  const [mode, setMode] = React.useState<SourceMode>("file");
  const [file, setFile] = React.useState<File | null>(null);
  const [fromRecording, setFromRecording] = React.useState(false);
  const [name, setName] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [shortcutUrl, setShortcutUrl] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setMode("file");
    setFile(null);
    setFromRecording(false);
    setName("");
    setTags("");
    setDescription("");
    setError("");
    setShortcutUrl("");
    setCopied(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const applyFile = (f: File | null, recorded: boolean) => {
    setFile(f);
    setFromRecording(recorded);
    setError("");
    if (f && !name.trim()) {
      const base = f.name.replace(/\.[^.]+$/, "") || "录音";
      setName(recorded ? base.replace(/^recording-/, "录音 ") : base);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError(mode === "record" ? "请先完成录音并确认使用" : "请选择文件");
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
      if (fromRecording || file.type.startsWith("audio/")) {
        form.append("category", "audio");
      }
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
            可选择本地文件，或直接录制语音上传。上传成功后会自动生成快捷指令专用链接。
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
            <div
              className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/40 p-1"
              role="tablist"
              aria-label="上传方式"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "file"}
                className={cn(
                  "flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition",
                  mode === "file"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => {
                  setMode("file");
                  setError("");
                }}
              >
                <FileUp className="h-4 w-4" />
                选择文件
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "record"}
                className={cn(
                  "flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition",
                  mode === "record"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => {
                  setMode("record");
                  setError("");
                }}
              >
                <Mic className="h-4 w-4" />
                录制语音
              </button>
            </div>

            {mode === "file" ? (
              <div className="space-y-2">
                <Label htmlFor="file">文件</Label>
                <Input
                  ref={fileInputRef}
                  id="file"
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    applyFile(f, false);
                  }}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>麦克风录音</Label>
                <VoiceRecorder
                  active={open && mode === "record"}
                  disabled={loading}
                  onReady={(f) => applyFile(f, true)}
                  onClear={() => {
                    if (fromRecording) {
                      setFile(null);
                      setFromRecording(false);
                    }
                  }}
                />
                {file && fromRecording && (
                  <p className="truncate text-xs text-sky-300">
                    已选定录音：{file.name}（{(file.size / 1024).toFixed(1)} KB）
                  </p>
                )}
              </div>
            )}

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
                placeholder={fromRecording ? "语音, 录音" : "电影, 4K"}
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
            <Button type="submit" className="w-full min-h-11" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {loading ? "上传中..." : fromRecording ? "上传录音" : "开始上传"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
