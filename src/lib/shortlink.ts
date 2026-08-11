import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { FileModel } from "@/models/File";
import { ShortlinkUser, type ShortlinkUserDocument } from "@/models/ShortlinkUser";
import { ApiError } from "@/lib/api";
import { ensureUserApiToken } from "@/lib/token-auth";
import { getAppUrl } from "@/lib/utils";

/** Shortlink public userId: 2–8 letters/digits */
export const SHORTLINK_USER_ID_REGEXP = /^[a-zA-Z0-9]{2,8}$/;

/** Fixed public origin for copyable APL URLs */
export const PUBLIC_APL_ORIGIN = (
  process.env.PUBLIC_APL_ORIGIN ||
  process.env.NEXTAUTH_URL ||
  "https://cq.imim.chat"
).replace(/\/$/, "");

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

/** Prefer username when it matches shortlink userId rules */
export function preferShortlinkUserIdFromUsername(username?: string | null): string {
  const raw = String(username || "").trim();
  if (SHORTLINK_USER_ID_REGEXP.test(raw)) return raw;
  return generateShortlinkUserId();
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
 * Absolute public short URL — always `https://cq.imim.chat/apl/{userId}`
 * unless PUBLIC_APL_ORIGIN / NEXTAUTH_URL overrides the origin.
 */
export function buildPublicAplUrl(userId: string): string {
  return `${PUBLIC_APL_ORIGIN}/apl/${userId}`;
}

/** @deprecated Prefer buildPublicAplUrl for copyable links; kept for request-aware redirects */
export function buildAplUrl(userId: string, req?: Request): string {
  // Copyable / displayed links must stay fixed to the public APL origin.
  void req;
  return buildPublicAplUrl(userId);
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
 * Each MediaVault user permanently owns one shortlink row.
 * userId never changes when audio is swapped.
 */
export async function ensureShortlinkForMediaVaultUser(params: {
  mediaVaultUserId: string;
  username?: string | null;
  remainingTimes?: number;
}): Promise<ShortlinkUserDocument> {
  if (!mongoose.Types.ObjectId.isValid(params.mediaVaultUserId)) {
    throw new ApiError("无效的用户 ID", 400);
  }

  const linkedUserId = new mongoose.Types.ObjectId(params.mediaVaultUserId);
  const existing = await ShortlinkUser.findOne({ linkedUserId });
  if (existing) return existing as ShortlinkUserDocument;

  const preferred = preferShortlinkUserIdFromUsername(params.username);
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
    return created as ShortlinkUserDocument;
  } catch (error: unknown) {
    const again = await ShortlinkUser.findOne({ linkedUserId });
    if (again) return again as ShortlinkUserDocument;
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

/**
 * Build redirect target for a bound MediaVault file:
 *   {base}/api/files/{fileId}/download?token={apiToken}
 */
export async function buildFileDownloadRedirectUrl(
  fileId: string,
  req?: Request
): Promise<string> {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError("无效的音频文件 ID", 400);
  }

  await connectDB();
  const file = await FileModel.findById(fileId).select("_id").lean();
  if (!file) {
    throw new ApiError("绑定的音频文件不存在", 404);
  }

  const token = await resolveShortlinkApiToken();
  const base = resolveRequestBase(req);
  const target = new URL(`${base}/api/files/${fileId}/download`);
  target.searchParams.set("token", token);
  return target.toString();
}
