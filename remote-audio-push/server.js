/**
 * Admin-only Remote Audio Control
 * - Admin Web console emits play/stop (ADMIN_TOKEN)
 * - iPhone receivers only join + listen (RECEIVER_TOKEN)
 * - No end-user login; receivers identified by userId room
 */
require("dotenv").config();
const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { nanoid } = require("nanoid");

const PORT = Number(process.env.PORT || 3002);
const HOST = process.env.HOST || "0.0.0.0";
// Prefer ADMIN_TOKEN; AUTH_TOKEN kept for backward compatibility
const ADMIN_TOKEN =
  process.env.ADMIN_TOKEN || process.env.AUTH_TOKEN || "dev-admin-token-change-me";
const RECEIVER_TOKEN = process.env.RECEIVER_TOKEN || ADMIN_TOKEN;
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, "");
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const MAX_AUDIO_URL_LENGTH = Number(process.env.MAX_AUDIO_URL_LENGTH || 2048);

const app = express();
const server = http.createServer(app);

const corsOrigins =
  CORS_ORIGIN === "*"
    ? "*"
    : CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);

app.use(cors({ origin: corsOrigins === "*" ? true : corsOrigins }));
app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "5m" }));

/** @type {Map<string, { userId: string; deviceId: string; connectedAt: number; lastSeen: number; userAgent?: string }>} */
const presence = new Map();

function roomOf(userId) {
  return `user:${String(userId).trim()}`;
}

function isAdminToken(token) {
  return typeof token === "string" && token.length > 0 && token === ADMIN_TOKEN;
}

function isReceiverToken(token) {
  return typeof token === "string" && token.length > 0 && token === RECEIVER_TOKEN;
}

function canConnect(token) {
  return isAdminToken(token) || isReceiverToken(token);
}

function sanitizePlayPayload(body) {
  const userId = String(body.userId || "").trim();
  const audioUrl = String(body.audioUrl || "").trim();
  const title = String(body.title || "Remote Audio").trim().slice(0, 120);
  const volume = Math.min(1, Math.max(0, Number(body.volume ?? 1)));

  if (!userId || userId.length > 64) return { error: "invalid userId" };
  if (!audioUrl || audioUrl.length > MAX_AUDIO_URL_LENGTH) return { error: "invalid audioUrl" };

  let parsed;
  try {
    parsed = new URL(audioUrl);
  } catch {
    return { error: "audioUrl must be absolute http(s) URL" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { error: "audioUrl protocol must be http/https" };
  }

  return {
    ok: true,
    payload: {
      commandId: nanoid(12),
      type: "play",
      userId,
      audioUrl,
      title,
      volume,
      ts: Date.now(),
    },
  };
}

function listOnline() {
  const byUser = new Map();
  for (const p of presence.values()) {
    const list = byUser.get(p.userId) || [];
    list.push({
      deviceId: p.deviceId,
      connectedAt: p.connectedAt,
      lastSeen: p.lastSeen,
      userAgent: p.userAgent || "",
    });
    byUser.set(p.userId, list);
  }
  return Array.from(byUser.entries()).map(([userId, devices]) => ({
    userId,
    devices,
    deviceCount: devices.length,
  }));
}

function receiverCount(userId) {
  const room = io.sockets.adapter.rooms.get(roomOf(userId));
  if (!room) return 0;
  let n = 0;
  for (const sid of room) {
    const s = io.sockets.sockets.get(sid);
    if (s?.data?.role === "receiver") n += 1;
  }
  return n;
}

function pushPlay(payload) {
  const room = roomOf(payload.userId);
  io.to(room).emit("play", payload);
  io.to(room).emit("command", payload);
  io.to("admin").emit("play_sent", {
    commandId: payload.commandId,
    userId: payload.userId,
    receivers: receiverCount(payload.userId),
    ts: payload.ts,
  });
  return receiverCount(payload.userId);
}

function pushStop(userId) {
  const payload = {
    commandId: nanoid(12),
    type: "stop",
    userId,
    ts: Date.now(),
  };
  io.to(roomOf(userId)).emit("stop", payload);
  io.to(roomOf(userId)).emit("command", payload);
  return payload;
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "remote-audio-push",
    mode: "admin-only",
    onlineUsers: listOnline().length,
    publicUrl: PUBLIC_URL,
  });
});

app.get("/api/online", (req, res) => {
  if (!isAdminToken(req.header("x-auth-token") || req.query.token)) {
    return res.status(401).json({ error: "admin token required" });
  }
  res.json({ items: listOnline() });
});

/** Admin HTTP play — REST fallback; Socket.io play is faster. */
app.post("/api/play", (req, res) => {
  if (!isAdminToken(req.header("x-auth-token") || req.body?.token)) {
    return res.status(401).json({ error: "admin token required" });
  }
  const parsed = sanitizePlayPayload(req.body || {});
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const receivers = pushPlay(parsed.payload);
  res.json({
    ok: true,
    commandId: parsed.payload.commandId,
    receivers,
    room: roomOf(parsed.payload.userId),
    latencyHintMs: receivers > 0 ? "<1000" : "no online receiver",
  });
});

app.post("/api/stop", (req, res) => {
  if (!isAdminToken(req.header("x-auth-token") || req.body?.token)) {
    return res.status(401).json({ error: "admin token required" });
  }
  const userId = String(req.body?.userId || "").trim();
  if (!userId) return res.status(400).json({ error: "userId required" });
  const payload = pushStop(userId);
  res.json({ ok: true, commandId: payload.commandId });
});

const io = new Server(server, {
  path: "/socket.io",
  cors: {
    origin: corsOrigins === "*" ? "*" : corsOrigins,
    methods: ["GET", "POST"],
  },
  pingInterval: 10000,
  pingTimeout: 8000,
  maxHttpBufferSize: 1e5,
  transports: ["websocket", "polling"],
  allowUpgrades: true,
});

io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.query?.token ||
    socket.handshake.headers["x-auth-token"];
  if (!canConnect(token)) return next(new Error("unauthorized"));
  socket.data.isAdmin = isAdminToken(token);
  socket.data.tokenKind = socket.data.isAdmin ? "admin" : "receiver";
  next();
});

io.on("connection", (socket) => {
  const deviceId = String(socket.handshake.auth?.deviceId || nanoid(10));
  socket.data.deviceId = deviceId;

  socket.emit("hello", {
    ok: true,
    deviceId,
    roleAllowed: socket.data.isAdmin ? ["admin", "receiver"] : ["receiver"],
    serverTime: Date.now(),
    publicUrl: PUBLIC_URL,
  });

  socket.on("join", (msg, ack) => {
    const userId = String(msg?.userId || "").trim();
    let role = String(msg?.role || "receiver");

    if (role === "controller" || role === "admin") {
      if (!socket.data.isAdmin) {
        if (typeof ack === "function") ack({ ok: false, error: "admin token required" });
        return;
      }
      role = "admin";
      socket.join("admin");
      socket.data.role = "admin";
      socket.data.userId = userId || null;
      if (typeof ack === "function") {
        ack({ ok: true, role: "admin", deviceId, online: listOnline() });
      }
      return;
    }

    // Receiver path — no login, only userId binding
    if (!userId || userId.length > 64) {
      if (typeof ack === "function") ack({ ok: false, error: "invalid userId" });
      return;
    }

    if (socket.data.userId) {
      socket.leave(roomOf(socket.data.userId));
      presence.delete(socket.id);
    }

    socket.data.userId = userId;
    socket.data.role = "receiver";
    socket.join(roomOf(userId));

    presence.set(socket.id, {
      userId,
      deviceId,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      userAgent: socket.handshake.headers["user-agent"] || "",
    });

    io.to("admin").emit("presence", { items: listOnline() });

    if (typeof ack === "function") {
      ack({ ok: true, room: roomOf(userId), deviceId, role: "receiver" });
    }
  });

  socket.on("play", (msg, ack) => {
    if (!socket.data.isAdmin) {
      if (typeof ack === "function") ack({ ok: false, error: "admin only" });
      return;
    }
    const parsed = sanitizePlayPayload(msg || {});
    if (parsed.error) {
      if (typeof ack === "function") ack({ ok: false, error: parsed.error });
      return;
    }
    const receivers = pushPlay(parsed.payload);
    if (typeof ack === "function") {
      ack({ ok: true, commandId: parsed.payload.commandId, receivers });
    }
  });

  socket.on("stop", (msg, ack) => {
    if (!socket.data.isAdmin) {
      if (typeof ack === "function") ack({ ok: false, error: "admin only" });
      return;
    }
    const userId = String(msg?.userId || "").trim();
    if (!userId) {
      if (typeof ack === "function") ack({ ok: false, error: "userId required" });
      return;
    }
    const payload = pushStop(userId);
    if (typeof ack === "function") ack({ ok: true, commandId: payload.commandId });
  });

  socket.on("ping_ts", (clientTs, ack) => {
    const p = presence.get(socket.id);
    if (p) p.lastSeen = Date.now();
    if (typeof ack === "function") ack({ serverTime: Date.now(), echo: clientTs });
  });

  socket.on("disconnect", () => {
    const wasReceiver = socket.data.role === "receiver";
    presence.delete(socket.id);
    if (wasReceiver) io.to("admin").emit("presence", { items: listOnline() });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[remote-audio-push] admin-only mode on http://${HOST}:${PORT}`);
  console.log(`[remote-audio-push] public ${PUBLIC_URL}`);
});
