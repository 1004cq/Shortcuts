import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { FileModel } from "@/models/File";
import { ApiError } from "@/lib/api";
import { ensureUserApiToken } from "@/lib/token-auth";
import { getAppUrl } from "@/lib/utils";

/** Shortlink public userId: 2–8 letters/digits */
export const SHORTLINK_USER_ID_REGEXP = /^[a-zA-Z0-9]{2,8}$/;

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

/** Absolute public short URL for a userId */
export function buildAplUrl(userId: string, req?: Request): string {
  const base = resolveRequestBase(req);
  return `${base}/apl/${encodeURIComponent(userId)}`;
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
