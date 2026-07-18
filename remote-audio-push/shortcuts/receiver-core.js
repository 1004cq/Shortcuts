/**
 * Apple Shortcuts / Scriptable 可用的接收端核心逻辑（参考实现）
 *
 * 说明：
 * - 系统「快捷指令」本身无法在后台长期维持真正的 WebSocket。
 * - 推荐做法：快捷指令打开 receiver.html（本仓库 public/receiver.html），
 *   由该页的 JavaScript 维持 Socket.io 连接并播放音频。
 * - 若使用 Scriptable App，可把下方类逻辑放入脚本，并配合通知点击打开。
 *
 * Socket.io 浏览器客户端需先加载：
 *   https://cdn.socket.io/4.8.1/socket.io.min.js
 */

/* eslint-disable no-undef */

const CONFIG = {
  // 页面在 nginx 下：https://cq.imim.chat/realtime/receiver.html
  path: "/realtime/socket.io",
  token: "YOUR_AUTH_TOKEN",
  userId: "user_b",
  reconnectDelayMin: 400,
  reconnectDelayMax: 4000,
};

function createRemoteAudioReceiver(cfg = CONFIG) {
  let socket = null;
  let audio = null;
  let unlocked = false;

  async function unlock() {
    audio = audio || new Audio();
    audio.src =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
    await audio.play();
    audio.pause();
    unlocked = true;
  }

  async function play(payload) {
    audio = audio || new Audio();
    audio.pause();
    audio.src = payload.audioUrl;
    audio.volume = typeof payload.volume === "number" ? payload.volume : 1;
    audio.load();
    await audio.play();
  }

  function stop() {
    if (!audio) return;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }

  function connect() {
    socket = io({
      path: cfg.path,
      auth: { token: cfg.token, deviceId: "shortcuts-" + Date.now().toString(36) },
      transports: ["websocket"],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: cfg.reconnectDelayMin,
      reconnectionDelayMax: cfg.reconnectDelayMax,
    });

    socket.on("connect", () => {
      socket.emit("join", { userId: cfg.userId, role: "receiver" });
    });

    socket.on("play", (payload) => {
      play(payload).catch((e) => console.error("play failed", e));
    });

    socket.on("stop", stop);

    socket.on("command", (payload) => {
      if (payload?.type === "play") play(payload);
      if (payload?.type === "stop") stop();
    });

    return socket;
  }

  return { unlock, connect, play, stop };
}

// Shortcuts「在网页上运行 JavaScript」示例入口：
// completion(JSON.stringify({ ok: true }))
async function shortcutsMain(completion) {
  try {
    const rx = createRemoteAudioReceiver(CONFIG);
    await rx.unlock();
    rx.connect();
    completion(JSON.stringify({ ok: true, mode: "listening" }));
  } catch (e) {
    completion(JSON.stringify({ ok: false, error: String(e) }));
  }
}

if (typeof completion === "function") {
  shortcutsMain(completion);
}
