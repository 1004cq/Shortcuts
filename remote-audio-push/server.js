/**
 * Remote Audio Push — Express + Socket.io
 * Web / admin emits "play"; iPhone receivers in room user:{userId} play instantly.
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
const AUTH_TOKEN = process.env.AUTH_TOKEN || "dev-token-change-me";
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, "");
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const MAX_AUDIO_URL_LENGTH = Number(process.env.MAX_AUDIO_URL_LENGTH || 2048);

const app = express();
const server = http.createServer(app);

const corsOrigins =
  CORS_ORIGIN === "*"
    ? "*"
    : CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);

app.use(
  cors({
    origin: corsOrigins === "*" ? true : corsOrigins,
  })
);
app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "5m" }));

/** @type {Map<string, { userId: string; deviceId: string; connectedAt: number; lastSeen: number; userAgent?: string }>} */
const presence = new Map();

function roomOf(userId) {
  return `user:${String(userId).trim()}`;
}

function assertAuth(token) {
  return typeof token === "string" && token.length > 0 && token === AUTH_TOKEN;
}

function sanitizePlayPayload(body) {
  const userId = String(body.userId || "").trim();
  const audioUrl = String(body.audioUrl || "").trim();
  const title = String(body.title || "Remote Audio").trim().slice(0, 120);
  const volume = Math.min(1, Math.max(0, Number(body.volume ?? 1)));

  if (!userId || userId.length > 64) {
    return { error: "invalid userId" };
  }
  if (!audioUrl || audioUrl.length > MAX_AUDIO_URL_LENGTH) {
    return { error: "invalid audioUrl" };
  }
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

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "remote-audio-push",
    onlineUsers: listOnline().length,
    publicUrl: PUBLIC_URL,
  });
});

app.get("/api/online", (req, res) => {
  if (!assertAuth(req.header("x-auth-token") || req.query.token)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  res.json({ items: listOnline() });
});

/**
 * HTTP fallback for play (MediaVault / Shortcuts / curl).
 * Prefer Socket.io "play" from the Web console for lowest latency.
 */
app.post("/api/play", (req, res) => {
  if (!assertAuth(req.header("x-auth-token") || req.body?.token)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const parsed = sanitizePlayPayload(req.body || {});
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  const room = roomOf(parsed.payload.userId);
  const sockets = io.sockets.adapter.rooms.get(room);
  const receivers = sockets ? sockets.size : 0;

  io.to(room).emit("play", parsed.payload);
  io.to(room).emit("command", parsed.payload);

  res.json({
    ok: true,
    commandId: parsed.payload.commandId,
    receivers,
    room,
    latencyHintMs: receivers > 0 ? "<1000" : "no online receiver",
  });
});

app.post("/api/stop", (req, res) => {
  if (!assertAuth(req.header("x-auth-token") || req.body?.token)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const userId = String(req.body?.userId || "").trim();
  if (!userId) return res.status(400).json({ error: "userId required" });
  const payload = {
    commandId: nanoid(12),
    type: "stop",
    userId,
    ts: Date.now(),
  };
  io.to(roomOf(userId)).emit("stop", payload);
  io.to(roomOf(userId)).emit("command", payload);
  res.json({ ok: true, commandId: payload.commandId });
});

const io = new Server(server, {
  path: "/socket.io",
  cors: {
    origin: corsOrigins === "*" ? "*" : corsOrigins,
    methods: ["GET", "POST"],
  },
  // Favor low latency over buffering
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
  if (!assertAuth(token)) {
    return next(new Error("unauthorized"));
  }
  next();
});

io.on("connection", (socket) => {
  const deviceId = String(socket.handshake.auth?.deviceId || nanoid(10));
  socket.data.deviceId = deviceId;

  socket.emit("hello", {
    ok: true,
    deviceId,
    serverTime: Date.now(),
    publicUrl: PUBLIC_URL,
  });

  socket.on("join", (msg, ack) => {
    const userId = String(msg?.userId || "").trim();
    const role = String(msg?.role || "receiver"); // receiver | controller
    if (!userId || userId.length > 64) {
      if (typeof ack === "function") ack({ ok: false, error: "invalid userId" });
      return;
    }

    // Leave previous room if any
    if (socket.data.userId) {
      socket.leave(roomOf(socket.data.userId));
      presence.delete(socket.id);
    }

    socket.data.userId = userId;
    socket.data.role = role;
    socket.join(roomOf(userId));

    presence.set(socket.id, {
      userId,
      deviceId,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      userAgent: socket.handshake.headers["user-agent"] || "",
    });

    io.emit("presence", { items: listOnline() });

    if (typeof ack === "function") {
      ack({ ok: true, room: roomOf(userId), deviceId, role });
    }
  });

  socket.on("play", (msg, ack) => {
    const parsed = sanitizePlayPayload({
      ...(msg || {}),
      userId: msg?.userId || socket.data.userId,
    });
    if (parsed.error) {
      if (typeof ack === "function") ack({ ok: false, error: parsed.error });
      return;
    }
    const room = roomOf(parsed.payload.userId);
    const receivers = io.sockets.adapter.rooms.get(room)?.size || 0;
    io.to(room).emit("play", parsed.payload);
    io.to(room).emit("command", parsed.payload);
    if (typeof ack === "function") {
      ack({ ok: true, commandId: parsed.payload.commandId, receivers });
    }
  });

  socket.on("stop", (msg, ack) => {
    const userId = String(msg?.userId || socket.data.userId || "").trim();
    if (!userId) {
      if (typeof ack === "function") ack({ ok: false, error: "userId required" });
      return;
    }
    const payload = {
      commandId: nanoid(12),
      type: "stop",
      userId,
      ts: Date.now(),
    };
    io.to(roomOf(userId)).emit("stop", payload);
    io.to(roomOf(userId)).emit("command", payload);
    if (typeof ack === "function") ack({ ok: true, commandId: payload.commandId });
  });

  socket.on("ping_ts", (clientTs, ack) => {
    const p = presence.get(socket.id);
    if (p) p.lastSeen = Date.now();
    if (typeof ack === "function") {
      ack({ serverTime: Date.now(), echo: clientTs });
    }
  });

  socket.on("disconnect", () => {
    presence.delete(socket.id);
    io.emit("presence", { items: listOnline() });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[remote-audio-push] http://${HOST}:${PORT}`);
  console.log(`[remote-audio-push] public ${PUBLIC_URL}`);
  console.log(`[remote-audio-push] auth token length=${AUTH_TOKEN.length}`);
});
