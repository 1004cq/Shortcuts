import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { FileModel } from "@/models/File";
import { ShortlinkUser } from "@/models/ShortlinkUser";

type ShortlinkDoc = InstanceType<typeof ShortlinkUser>;
import { ApiError } from "@/lib/api";
import { ensureUserApiToken } from "@/lib/token-auth";
import { getAppUrl } from "@/lib/utils";

/** Shortlink public userId: 2–8 letters/digits */
export const SHORTLINK_USER_ID_REGEXP = /^[a-zA-Z0-9]{2,8}$/;

/** Fixed public origin for copyable short URLs */
export const PUBLIC_SHORTLINK_ORIGIN = (
  process.env.PUBLIC_SHORTLINK_ORIGIN ||
  process.env.PUBLIC_APL_ORIGIN ||
  process.env.NEXTAUTH_URL ||
  "https://cq.imim.chat"
).replace(/\/$/, "");

/** @deprecated use PUBLIC_SHORTLINK_ORIGIN */
export const PUBLIC_APL_ORIGIN = PUBLIC_SHORTLINK_ORIGIN;

export function isValidShortlinkUserId(userId: unknown): userId is string {
  return typeof userId === "string" && SHORTLINK_USER_ID_REGEXP.test(userId);
}

/**
 * Random 2–8 char userId that is not in `existing`.
 */
export function generateShortlinkUserId(existing: Iterable<string> = []): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const taken = new Set(existing);
  for (let attempt = 0; attempt < 120; attempt++) {
    const length = 2 + Math.floor(Math.random() * 7);
    let id = "";
    for (let i = 0; i < length; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (!taken.has(id)) return id;
  }
  return `u${Date.now().toString(36)}`.slice(0, 8);
}

/**
 * Prefer profile fields that already look like a shortlink id:
 * username first, then display name (e.g. "cq").
 */
export function preferShortlinkUserIdFromProfile(opts: {
  username?: string | null;
  name?: string | null;
}): string {
  for (const raw of [opts.username, opts.name]) {
    const v = String(raw || "").trim();
    if (SHORTLINK_USER_ID_REGEXP.test(v)) return v;
  }
  return generateShortlinkUserId();
}

/** @deprecated use preferShortlinkUserIdFromProfile */
export function preferShortlinkUserIdFromUsername(username?: string | null): string {
  return preferShortlinkUserIdFromProfile({ username });
}

export async function ensureUniqueShortlinkUserId(preferred: string): Promise<string> {
  let candidate = preferred;
  if (!SHORTLINK_USER_ID_REGEXP.test(candidate)) {
    candidate = generateShortlinkUserId();
  }

  for (let i = 0; i < 40; i++) {
    const exists = await ShortlinkUser.findOne({ userId: candidate }).lean();
    if (!exists) return candidate;
    candidate = generateShortlinkUserId();
  }

  throw new ApiError("无法生成唯一短链用户 ID", 500);
}

/**
 * If username/name is a valid free shortlink id and differs from current,
 * rename so /api/{id} tracks the profile in realtime.
 */
export async function syncShortlinkIdToProfile(
  doc: ShortlinkDoc,
  opts: { username?: string | null; name?: string | null }
): Promise<ShortlinkDoc> {
  const preferred = preferShortlinkUserIdFromProfile(opts);
  // Only auto-sync when preferred came from a real profile field (not random)
  const fromProfile = [opts.username, opts.name].some((raw) => {
    const v = String(raw || "").trim();
    return SHORTLINK_USER_ID_REGEXP.test(v) && v === preferred;
  });
  if (!fromProfile) return doc;
  if (doc.userId === preferred) return doc;

  const clash = await ShortlinkUser.findOne({
    userId: preferred,
    _id: { $ne: doc._id },
  }).lean();
  if (clash) return doc;

  doc.userId = preferred;
  try {
    await doc.save();
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 11000) return doc;
    throw err;
  }
  return doc;
}

/**
 * Absolute public short URL — `https://cq.imim.chat/api/{userId}`
 */
export function buildPublicShortUrl(userId: string): string {
  return `${PUBLIC_SHORTLINK_ORIGIN}/api/${userId}`;
}

/** @deprecated use buildPublicShortUrl */
export function buildPublicAplUrl(userId: string): string {
  return buildPublicShortUrl(userId);
}

/** @deprecated Prefer buildPublicShortUrl for copyable links */
export function buildAplUrl(userId: string, req?: Request): string {
  void req;
  return buildPublicShortUrl(userId);
}

function resolveRequestBase(req?: Request): string {
  if (req) {
    const url = new URL(req.url);
    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      url.host;
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") ? "http" : "https");
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  }
  return getAppUrl().replace(/\/$/, "");
}

/**
 * Each MediaVault user owns one shortlink row.
 * When username/name is a valid free id, short path stays in sync with profile.
 */
export async function ensureShortlinkForMediaVaultUser(params: {
  mediaVaultUserId: string;
  username?: string | null;
  name?: string | null;
  remainingTimes?: number;
}): Promise<ShortlinkDoc> {
  if (!mongoose.Types.ObjectId.isValid(params.mediaVaultUserId)) {
    throw new ApiError("无效的用户 ID", 400);
  }

  const linkedUserId = new mongoose.Types.ObjectId(params.mediaVaultUserId);
  const existing = await ShortlinkUser.findOne({ linkedUserId });
  if (existing) {
    return syncShortlinkIdToProfile(existing as ShortlinkDoc, {
      username: params.username,
      name: params.name,
    });
  }

  const preferred = preferShortlinkUserIdFromProfile({
    username: params.username,
    name: params.name,
  });
  const userId = await ensureUniqueShortlinkUserId(preferred);
  const remainingTimes =
    typeof params.remainingTimes === "number" && Number.isFinite(params.remainingTimes)
      ? Math.max(0, Math.floor(params.remainingTimes))
      : 10;

  try {
    const created = await ShortlinkUser.create({
      userId,
      fileId: null,
      linkedUserId,
      remainingTimes,
      usedTimes: 0,
      lastAccessTime: null,
    });
    return created as ShortlinkDoc;
  } catch (error: unknown) {
    const again = await ShortlinkUser.findOne({ linkedUserId });
    if (again) {
      return syncShortlinkIdToProfile(again as ShortlinkDoc, {
        username: params.username,
        name: params.name,
      });
    }
    throw error;
  }
}

/**
 * Resolve VIP/admin API token used to authorize /api/files/:id/download.
 * Prefer SHORTLINK_API_TOKEN env; otherwise ensure an admin user's apiToken.
 */
export async function resolveShortlinkApiToken(): Promise<string> {
  const fromEnv = process.env.SHORTLINK_API_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  await connectDB();
  const admin = await User.findOne({ role: "admin" }).select("_id").lean();
  if (!admin) {
    throw new ApiError("系统未配置管理员，无法生成下载 Token", 500);
  }
  return ensureUserApiToken(String(admin._id));
}

/** Audio or video that can be bound to a user shortlink. */
export function isShortlinkMediaFile(file: {
  category?: string | null;
  mimeType?: string | null;
}): boolean {
  const cat = String(file.category || "");
  const mime = String(file.mimeType || "");
  return (
    cat === "audio" ||
    cat === "video" ||
    mime.startsWith("audio/") ||
    mime.startsWith("video/")
  );
}

export function shortlinkMediaKind(file: {
  category?: string | null;
  mimeType?: string | null;
}): "audio" | "video" | null {
  const cat = String(file.category || "");
  const mime = String(file.mimeType || "");
  if (cat === "video" || mime.startsWith("video/")) return "video";
  if (cat === "audio" || mime.startsWith("audio/")) return "audio";
  return null;
}

/**
 * Build redirect target for a bound MediaVault file:
 *   {base}/api/files/{fileId}/download?token={apiToken}
 */
export async function buildFileDownloadRedirectUrl(
  fileId: string,
  req?: Request
): Promise<string> {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError("无效的媒体文件 ID", 400);
  }

  await connectDB();
  const file = await FileModel.findById(fileId)
    .select("_id category mimeType")
    .lean();
  if (!file) {
    throw new ApiError("绑定的媒体文件不存在", 404);
  }
  if (!isShortlinkMediaFile(file)) {
    throw new ApiError("绑定的文件不是音频或视频", 400);
  }

  const token = await resolveShortlinkApiToken();
  const base = resolveRequestBase(req);
  const target = new URL(`${base}/api/files/${fileId}/download`);
  target.searchParams.set("token", token);
  return target.toString();
}
