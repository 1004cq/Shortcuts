/**
 * location-audio-pull — Express 服务
 *
 * 用户（苹果快捷指令）主动 POST 位置 → 若有待播音频则返回 URL
 * 管理员通过 HTML 后台投递音频、查看最新位置
 *
 * 存储：默认内存；设置 PERSIST_FILE 后会把位置/队列落盘为 JSON
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");

const PORT = Number(process.env.PORT || 3003);
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_TOKEN = (process.env.ADMIN_TOKEN || process.env.AUTH_TOKEN || "").trim();
const USER_TOKEN = (process.env.USER_TOKEN || ADMIN_TOKEN || "").trim();
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, "");
const PERSIST_FILE = (process.env.PERSIST_FILE || "").trim();
const MAX_QUEUE = Math.max(1, Number(process.env.MAX_QUEUE || 20));

/** @typedef {{ lat: number, lng: number, accuracy?: number|null, updatedAt: number, userId: string }} LocationRow */
/** @typedef {{ audioUrl: string, title: string, createdAt: number, id: string }} QueueItem */

/** @type {Map<string, LocationRow>} */
const locations = new Map();
/** @type {Map<string, QueueItem[]>} */
const queues = new Map();

function now() {
  return Date.now();
}

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadPersist() {
  if (!PERSIST_FILE || !fs.existsSync(PERSIST_FILE)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(PERSIST_FILE, "utf8"));
    if (raw.locations && typeof raw.locations === "object") {
      for (const [k, v] of Object.entries(raw.locations)) locations.set(k, v);
    }
    if (raw.queues && typeof raw.queues === "object") {
      for (const [k, v] of Object.entries(raw.queues)) {
        if (Array.isArray(v)) queues.set(k, v);
      }
    }
    console.log(`[persist] loaded ${locations.size} locations, ${queues.size} queues`);
  } catch (e) {
    console.warn("[persist] load failed:", e.message);
  }
}

function savePersist() {
  if (!PERSIST_FILE) return;
  try {
    const dir = path.dirname(PERSIST_FILE);
    fs.mkdirSync(dir, { recursive: true });
    const payload = {
      savedAt: new Date().toISOString(),
      locations: Object.fromEntries(locations),
      queues: Object.fromEntries(queues),
    };
    fs.writeFileSync(PERSIST_FILE, JSON.stringify(payload, null, 2));
  } catch (e) {
    console.warn("[persist] save failed:", e.message);
  }
}

function isAdmin(req) {
  const t =
    req.header("x-admin-token") ||
    req.header("x-auth-token") ||
    req.query.token ||
    req.body?.token ||
    "";
  return Boolean(ADMIN_TOKEN) && String(t) === ADMIN_TOKEN;
}

function isUser(req) {
  const t =
    req.header("x-user-token") ||
    req.header("x-auth-token") ||
    req.query.token ||
    req.body?.token ||
    "";
  // 若未单独配置 USER_TOKEN，则与 ADMIN_TOKEN 相同（简化部署）
  const expected = USER_TOKEN || ADMIN_TOKEN;
  if (!expected) return true; // 开发模式：未配置 token 则放行
  return String(t) === expected;
}

function sanitizeUserId(raw) {
  const id = String(raw || "").trim();
  if (!id || id.length > 64) return null;
  if (!/^[a-zA-Z0-9_\-@.]+$/.test(id)) return null;
  return id;
}

function sanitizeAudioUrl(raw) {
  const u = String(raw || "").trim();
  if (!u || u.length > 2048) return null;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function getQueue(userId) {
  if (!queues.has(userId)) queues.set(userId, []);
  return queues.get(userId);
}

function enqueue(userId, audioUrl, title) {
  const q = getQueue(userId);
  const item = {
    id: uid(),
    audioUrl,
    title: String(title || "管理员推送").slice(0, 120),
    createdAt: now(),
  };
  q.push(item);
  while (q.length > MAX_QUEUE) q.shift();
  savePersist();
  return item;
}

function dequeue(userId) {
  const q = getQueue(userId);
  const item = q.shift() || null;
  if (item) savePersist();
  return item;
}

loadPersist();

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "location-audio-pull",
    publicUrl: PUBLIC_URL,
    usersTracked: locations.size,
    queues: queues.size,
  });
});

/**
 * 用户快捷指令入口（主动拉取）
 * POST /api/pull
 * Body: { userId, lat, lng, accuracy?, token? }
 * 返回: { ok, pending, audioUrl?, title?, commandId? }
 */
function handlePull(req, res) {
  if (!isUser(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const userId = sanitizeUserId(req.body?.userId ?? req.query?.userId);
  if (!userId) {
    return res.status(400).json({ ok: false, error: "userId required (字母数字_-.@)" });
  }

  const lat = Number(req.body?.lat ?? req.query?.lat);
  const lng = Number(req.body?.lng ?? req.query?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ ok: false, error: "invalid lat/lng" });
  }

  const accuracyRaw = req.body?.accuracy ?? req.query?.accuracy;
  const accuracy =
    accuracyRaw == null || accuracyRaw === "" ? null : Number(accuracyRaw);

  locations.set(userId, {
    userId,
    lat,
    lng,
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
    updatedAt: now(),
  });
  savePersist();

  const item = dequeue(userId);
  if (!item) {
    return res.json({
      ok: true,
      pending: false,
      audioUrl: "",
      title: "",
      message: "暂无待播音频",
    });
  }

  return res.json({
    ok: true,
    pending: true,
    audioUrl: item.audioUrl,
    title: item.title,
    commandId: item.id,
    message: "有待播音频",
  });
}

app.post("/api/pull", handlePull);

/** 兼容 GET（调试用）；正式快捷指令请用 POST */
app.get("/api/pull", (req, res) => {
  req.body = {
    userId: req.query.userId,
    lat: req.query.lat,
    lng: req.query.lng,
    accuracy: req.query.accuracy,
    token: req.query.token,
  };
  return handlePull(req, res);
});
/** 管理员：投递音频到用户队列 */
app.post("/api/admin/play", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: "admin token required" });

  const userId = sanitizeUserId(req.body?.userId);
  const audioUrl = sanitizeAudioUrl(req.body?.audioUrl);
  const title = String(req.body?.title || "管理员推送").slice(0, 120);

  if (!userId) return res.status(400).json({ ok: false, error: "userId required" });
  if (!audioUrl) return res.status(400).json({ ok: false, error: "valid audioUrl required (http/https)" });

  const item = enqueue(userId, audioUrl, title);
  res.json({
    ok: true,
    commandId: item.id,
    userId,
    queueLength: getQueue(userId).length,
    message: "已写入待播放队列，等待用户运行快捷指令拉取",
  });
});

/** 管理员：清空某用户队列 */
app.post("/api/admin/clear", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: "admin token required" });
  const userId = sanitizeUserId(req.body?.userId);
  if (!userId) return res.status(400).json({ ok: false, error: "userId required" });
  queues.set(userId, []);
  savePersist();
  res.json({ ok: true, userId, cleared: true });
});

/** 管理员：所有用户最新位置 */
app.get("/api/admin/locations", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: "admin token required" });
  const items = [...locations.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((row) => ({
      ...row,
      updatedAtIso: new Date(row.updatedAt).toISOString(),
      queueLength: getQueue(row.userId).length,
      mapUrl: `https://maps.google.com/?q=${row.lat},${row.lng}`,
    }));
  res.json({ ok: true, items, count: items.length });
});

/** 管理员：某用户队列预览 */
app.get("/api/admin/queue/:userId", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: "admin token required" });
  const userId = sanitizeUserId(req.params.userId);
  if (!userId) return res.status(400).json({ ok: false, error: "userId required" });
  res.json({ ok: true, userId, items: getQueue(userId) });
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_req, res) => {
  res.redirect("/admin.html");
});

if (!ADMIN_TOKEN) {
  console.warn("[warn] ADMIN_TOKEN 未设置 — 管理接口将拒绝请求。请在 .env 中配置。");
}

app.listen(PORT, HOST, () => {
  console.log(`[location-audio-pull] http://${HOST}:${PORT}`);
  console.log(`[location-audio-pull] admin: ${PUBLIC_URL}/admin.html`);
  console.log(`[location-audio-pull] pull:  POST ${PUBLIC_URL}/api/pull`);
});
