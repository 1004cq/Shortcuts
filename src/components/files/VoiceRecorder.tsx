"use client";

import * as React from "react";
import {
  Mic,
  Pause,
  Play,
  Square,
  RotateCcw,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RecorderPhase =
  | "idle"
  | "requesting"
  | "recording"
  | "paused"
  | "preview"
  | "denied"
  | "unsupported"
  | "error";

type VoiceRecorderProps = {
  onReady: (file: File) => void;
  onClear?: () => void;
  disabled?: boolean;
  /** When true, tear down mic / preview (e.g. dialog closed). */
  active?: boolean;
};

type MimePick = { mimeType: string; extension: string };

function pickRecorderMime(): MimePick {
  const candidates: MimePick[] = [
    { mimeType: "audio/webm;codecs=opus", extension: "webm" },
    { mimeType: "audio/webm", extension: "webm" },
    { mimeType: "audio/mp4", extension: "m4a" },
    { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
    { mimeType: "audio/mpeg", extension: "mp3" },
  ];
  if (typeof MediaRecorder === "undefined") {
    return { mimeType: "", extension: "webm" };
  }
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
  }
  return { mimeType: "", extension: "webm" };
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function permissionMessage(err: unknown): string {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name?: string }).name)
      : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "麦克风权限被拒绝。请在浏览器地址栏或系统设置中允许麦克风访问后重试。";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "未检测到麦克风设备，请连接麦克风后重试。";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "麦克风正被其他应用占用，请关闭后重试。";
  }
  if (name === "SecurityError") {
    return "当前环境无法使用麦克风（需 HTTPS 或 localhost）。";
  }
  if (err instanceof Error && err.message) return err.message;
  return "无法启动录音，请检查麦克风权限后重试。";
}

function buildFileName(extension: string): string {
  const d = new Date();
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
    "-",
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
    String(d.getSeconds()).padStart(2, "0"),
  ].join("");
  return `recording-${stamp}.${extension}`;
}

export function VoiceRecorder({
  onReady,
  onClear,
  disabled = false,
  active = true,
}: VoiceRecorderProps) {
  const [phase, setPhase] = React.useState<RecorderPhase>("idle");
  const [error, setError] = React.useState("");
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [canPause, setCanPause] = React.useState(false);

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const mimeRef = React.useRef<MimePick>({ mimeType: "", extension: "webm" });
  const startedAtRef = React.useRef(0);
  const accumulatedRef = React.useRef(0);
  const tickRef = React.useRef<number | null>(null);
  const blobRef = React.useRef<Blob | null>(null);
  const previewUrlRef = React.useRef<string | null>(null);

  const stopTicker = React.useCallback(() => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const startTicker = React.useCallback(() => {
    stopTicker();
    tickRef.current = window.setInterval(() => {
      setElapsedMs(accumulatedRef.current + (Date.now() - startedAtRef.current));
    }, 200);
  }, [stopTicker]);

  const releaseStream = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearPreview = React.useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    blobRef.current = null;
  }, []);

  const hardReset = React.useCallback(() => {
    stopTicker();
    try {
      const rec = mediaRecorderRef.current;
      if (rec && (rec.state === "recording" || rec.state === "paused")) {
        rec.onstop = null;
        rec.stop();
      }
    } catch {
      // ignore
    }
    mediaRecorderRef.current = null;
    releaseStream();
    chunksRef.current = [];
    accumulatedRef.current = 0;
    startedAtRef.current = 0;
    setElapsedMs(0);
    setPhase((prev) => (prev === "unsupported" ? prev : "idle"));
    setError("");
    setCanPause(false);
    clearPreview();
    onClear?.();
  }, [clearPreview, onClear, releaseStream, stopTicker]);

  React.useEffect(() => {
    if (!active) hardReset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  React.useEffect(() => {
    return () => {
      stopTicker();
      releaseStream();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, [releaseStream, stopTicker]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const ok =
      typeof MediaRecorder !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia;
    if (!ok) setPhase("unsupported");
  }, []);

  const finishToPreview = React.useCallback(
    (blob: Blob) => {
      releaseStream();
      stopTicker();
      blobRef.current = blob;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setPhase("preview");
    },
    [releaseStream, stopTicker]
  );

  const startRecording = async () => {
    if (disabled) return;
    setError("");
    setPhase("requesting");
    clearPreview();
    chunksRef.current = [];
    accumulatedRef.current = 0;
    setElapsedMs(0);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase("unsupported");
        setError("当前浏览器不支持录音，请使用最新版 Chrome / Safari / Edge。");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mime = pickRecorderMime();
      mimeRef.current = mime;
      const options = mime.mimeType ? { mimeType: mime.mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      const pauseSupported =
        typeof recorder.pause === "function" &&
        typeof recorder.resume === "function";
      setCanPause(pauseSupported);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onerror = () => {
        setError("录音过程中出错，请重试。");
        setPhase("error");
        releaseStream();
        stopTicker();
      };

      recorder.onstop = () => {
        const type =
          recorder.mimeType || mimeRef.current.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size < 1) {
          setError("录音为空，请重新录制。");
          setPhase("error");
          releaseStream();
          return;
        }
        finishToPreview(blob);
      };

      // timeslice keeps Safari / some mobile browsers flushing chunks
      recorder.start(1000);
      startedAtRef.current = Date.now();
      startTicker();
      setPhase("recording");
    } catch (err) {
      releaseStream();
      stopTicker();
      const msg = permissionMessage(err);
      const denied =
        err &&
        typeof err === "object" &&
        "name" in err &&
        (String((err as { name?: string }).name) === "NotAllowedError" ||
          String((err as { name?: string }).name) === "PermissionDeniedError");
      setError(msg);
      setPhase(denied ? "denied" : "error");
    }
  };

  const pauseRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state !== "recording") return;
    try {
      rec.pause();
      accumulatedRef.current += Date.now() - startedAtRef.current;
      stopTicker();
      setElapsedMs(accumulatedRef.current);
      setPhase("paused");
    } catch {
      setError("当前浏览器不支持暂停录音。");
    }
  };

  const resumeRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state !== "paused") return;
    try {
      rec.resume();
      startedAtRef.current = Date.now();
      startTicker();
      setPhase("recording");
    } catch {
      setError("无法继续录音，请重新开始。");
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    if (rec.state === "recording" || rec.state === "paused") {
      if (rec.state === "recording") {
        accumulatedRef.current += Date.now() - startedAtRef.current;
        setElapsedMs(accumulatedRef.current);
      }
      stopTicker();
      try {
        rec.stop();
      } catch {
        setError("停止录音失败，请重试。");
        setPhase("error");
      }
    }
  };

  const confirmRecording = () => {
    const blob = blobRef.current;
    if (!blob) return;
    const ext =
      mimeRef.current.extension ||
      (blob.type.includes("mp4")
        ? "m4a"
        : blob.type.includes("mpeg")
          ? "mp3"
          : blob.type.includes("ogg")
            ? "ogg"
            : "webm");
    const type = blob.type || `audio/${ext === "m4a" ? "mp4" : ext}`;
    const file = new File([blob], buildFileName(ext), { type });
    onReady(file);
  };

  const busy = phase === "requesting";

  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-muted/30 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Mic className="h-4 w-4 text-sky-400" />
          录制语音
        </div>
        <span
          className={cn(
            "font-mono text-sm tabular-nums",
            phase === "recording" && "text-rose-400",
            phase === "paused" && "text-amber-400",
            phase === "preview" && "text-sky-300"
          )}
        >
          {formatDuration(elapsedMs)}
        </span>
      </div>

      {phase === "unsupported" && (
        <p className="flex items-start gap-2 text-sm text-amber-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          当前浏览器不支持录音。请使用最新版 Chrome、Safari 或 Edge（需 HTTPS）。
        </p>
      )}

      {(phase === "denied" || phase === "error") && error && (
        <p className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {phase === "idle" || phase === "denied" || phase === "error" ? (
        <Button
          type="button"
          className="min-h-11 w-full"
          disabled={disabled || busy}
          onClick={() => void startRecording()}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          {phase === "denied" || phase === "error" ? "重新请求麦克风" : "开始录音"}
        </Button>
      ) : null}

      {phase === "requesting" && (
        <div className="flex min-h-11 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在请求麦克风权限…
        </div>
      )}

      {(phase === "recording" || phase === "paused") && (
        <div className="flex flex-wrap gap-2">
          {canPause && phase === "recording" && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1"
              onClick={pauseRecording}
              disabled={disabled}
            >
              <Pause className="h-4 w-4" />
              暂停
            </Button>
          )}
          {canPause && phase === "paused" && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1"
              onClick={resumeRecording}
              disabled={disabled}
            >
              <Play className="h-4 w-4" />
              继续
            </Button>
          )}
          <Button
            type="button"
            className="min-h-11 flex-1 bg-rose-500 text-white hover:bg-rose-400"
            onClick={stopRecording}
            disabled={disabled}
          >
            <Square className="h-4 w-4" />
            完成
          </Button>
        </div>
      )}

      {phase === "recording" && (
        <p className="text-center text-xs text-rose-300/90">
          ● 正在录音… 说完后点「完成」
        </p>
      )}
      {phase === "paused" && (
        <p className="text-center text-xs text-amber-300/90">已暂停</p>
      )}

      {phase === "preview" && previewUrl && (
        <div className="space-y-3">
          <audio
            controls
            src={previewUrl}
            className="w-full"
            preload="metadata"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1"
              disabled={disabled}
              onClick={() => {
                clearPreview();
                setPhase("idle");
                setElapsedMs(0);
                accumulatedRef.current = 0;
                onClear?.();
                void startRecording();
              }}
            >
              <RotateCcw className="h-4 w-4" />
              重录
            </Button>
            <Button
              type="button"
              className="min-h-11 flex-1"
              disabled={disabled}
              onClick={confirmRecording}
            >
              <Check className="h-4 w-4" />
              使用此录音
            </Button>
          </div>
        </div>
      )}

      {phase === "idle" && !error && (
        <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
          将调用浏览器麦克风直接录音，确认后无需保存到本地即可上传。手机与电脑均需允许麦克风权限。
        </p>
      )}
    </div>
  );
}
