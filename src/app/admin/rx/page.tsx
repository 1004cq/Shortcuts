"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { Loader2 } from "lucide-react";

/**
 * Public iPhone receiver under /admin/rx (no login).
 * Connects to Socket.io at /realtime/socket.io on the same host.
 */
function ReceiverInner() {
  const searchParams = useSearchParams();
  const [token, setToken] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [status, setStatus] = React.useState("离线");
  const [online, setOnline] = React.useState(false);
  const [now, setNow] = React.useState("待命…");
  const [log, setLog] = React.useState("");
  const socketRef = React.useRef<Socket | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const appendLog = React.useCallback((m: string) => {
    setLog((prev) => `[${new Date().toLocaleTimeString()}] ${m}\n${prev}`);
  }, []);

  const unlockAudio = React.useCallback(async () => {
    try {
      if (!audioRef.current) audioRef.current = new Audio();
      const audio = audioRef.current;
      audio.src =
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
      await audio.play();
      audio.pause();
      appendLog("audio unlocked");
    } catch (e) {
      appendLog("unlock failed: " + (e instanceof Error ? e.message : String(e)));
    }
  }, [appendLog]);

  const playRemote = React.useCallback(
    async (payload: { audioUrl: string; title?: string; volume?: number; commandId?: string }) => {
      const t0 = performance.now();
      setNow(`收到指令：${payload.title || "音频"}`);
      try {
        if (!audioRef.current) audioRef.current = new Audio();
        const audio = audioRef.current;
        audio.pause();
        audio.src = payload.audioUrl;
        audio.volume = typeof payload.volume === "number" ? payload.volume : 1;
        audio.load();
        await audio.play();
        const ms = Math.round(performance.now() - t0);
        setNow(`播放中：${payload.title || ""} · ${ms}ms`);
        appendLog(`playing ${payload.commandId || ""} in ${ms}ms`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setNow(`播放失败：${msg}`);
        appendLog("play error " + msg);
      }
    },
    [appendLog]
  );

  const stopRemote = React.useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setNow("已停止");
    appendLog("stopped");
  }, [appendLog]);

  const connect = React.useCallback(async () => {
    const t = token.trim();
    const uid = userId.trim();
    if (!t || !uid) {
      alert("请填写 Token 与用户 ID");
      return;
    }
    localStorage.setItem("rap_rx", JSON.stringify({ token: t, userId: uid }));
    await unlockAudio();

    socketRef.current?.disconnect();
    const socket = io({
      path: "/realtime/socket.io",
      auth: {
        token: t,
        deviceId:
          "iphone-" +
          (localStorage.getItem("rap_device") || Math.random().toString(36).slice(2, 8)),
      },
      transports: ["websocket"],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 400,
      reconnectionDelayMax: 4000,
      timeout: 8000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setOnline(true);
      setStatus("已连接，加入房间中…");
      socket.emit("join", { userId: uid, role: "receiver" }, (ack: { ok?: boolean }) => {
        setStatus(ack?.ok ? `在线 · ${uid}` : "加入失败");
        appendLog("join " + JSON.stringify(ack));
      });
    });
    socket.on("disconnect", (r) => {
      setOnline(false);
      setStatus("断开: " + r);
      appendLog("disconnect " + r);
    });
    socket.on("connect_error", (e) => {
      setOnline(false);
      setStatus("错误: " + e.message);
      appendLog("connect_error " + e.message);
    });
    socket.on("play", (payload) => {
      appendLog("event play");
      void playRemote(payload);
    });
    socket.on("stop", () => stopRemote());
    socket.on("command", (payload: { type?: string; audioUrl?: string }) => {
      if (payload?.type === "play") void playRemote(payload as never);
      if (payload?.type === "stop") stopRemote();
    });
  }, [token, userId, unlockAudio, playRemote, stopRemote, appendLog]);

  React.useEffect(() => {
    const qToken = searchParams.get("token") || "";
    const qUser = searchParams.get("userId") || "";
    try {
      const saved = JSON.parse(localStorage.getItem("rap_rx") || "{}") as {
        token?: string;
        userId?: string;
      };
      setToken(qToken || saved.token || "");
      setUserId(qUser || saved.userId || "");
    } catch {
      setToken(qToken);
      setUserId(qUser);
    }
  }, [searchParams]);

  React.useEffect(() => {
    if (searchParams.get("autostart") !== "1") return;
    if (!token || !userId) return;
    const t = setTimeout(() => {
      void connect();
    }, 200);
    return () => clearTimeout(t);
    // only auto once when params ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId, searchParams]);

  React.useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return (
    <div
      data-scroll-root
      className="scroll-root relative flex h-full min-h-0 items-center justify-center overflow-y-auto bg-[#070b14] px-4 py-8 text-slate-100"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.22),_transparent_55%)]" />
      <div className="relative w-full max-w-md rounded-2xl border border-white/12 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-xl">
        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">/admin/rx</p>
        <h1 className="mt-1 font-display text-xl font-semibold">iPhone 接收端</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          无需登录。保持本页在前台即可接收管理员从后台推送的音频。建议添加到主屏幕。
        </p>

        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
          <span
            className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400" : "bg-red-400"}`}
          />
          {status}
        </div>

        <label className="mt-4 block text-xs text-slate-400">接收 Token</label>
        <input
          className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-sky-400/60"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <label className="mt-3 block text-xs text-slate-400">我的用户 ID</label>
        <input
          className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-sky-400/60"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="与后台目标用户 ID 一致"
        />

        <button
          type="button"
          onClick={() => void connect()}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-400 to-sky-400 px-4 py-3 text-sm font-bold text-[#04120c]"
        >
          启动监听 / 解锁音频
        </button>

        <p className="mt-4 text-sm">{now}</p>
        <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-slate-400">
          {log}
        </pre>
      </div>
    </div>
  );
}

export default function AdminReceiverPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-full min-h-0 items-center justify-center bg-[#070b14] text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
    >
      <ReceiverInner />
    </React.Suspense>
  );
}
