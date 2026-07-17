import { nanoid } from "nanoid";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { isVipActive } from "@/lib/permissions";
import { ApiError, getAuthUser } from "@/lib/api";
import type { SessionUser } from "@/types";

/** Prefix makes tokens easy to recognize in Shortcuts / logs. */
export const API_TOKEN_PREFIX = "mv_";

export function generateApiToken(): string {
  return `${API_TOKEN_PREFIX}${nanoid(40)}`;
}

/** Read token from Authorization: Bearer or ?token= */
export function extractApiToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  const url = new URL(req.url);
  const q = url.searchParams.get("token")?.trim();
  return q || null;
}

function toSessionUser(doc: {
  _id: { toString(): string };
  email: string;
  name: string;
  role: SessionUser["role"];
  membership: SessionUser["membership"];
  membershipExpiresAt?: Date | null;
  emailVerified?: boolean;
  image?: string | null;
}): SessionUser {
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    role: doc.role,
    membership: doc.membership,
    membershipExpiresAt: doc.membershipExpiresAt
      ? new Date(doc.membershipExpiresAt).toISOString()
      : null,
    emailVerified: Boolean(doc.emailVerified),
    image: doc.image ?? null,
  };
}

/**
 * Resolve user from session cookie OR personal API token.
 * Prefer session when both are present.
 */
export async function resolveAuthUser(req: Request): Promise<SessionUser | null> {
  const sessionUser = await getAuthUser();
  if (sessionUser) return sessionUser;

  const token = extractApiToken(req);
  if (!token) return null;

  await connectDB();
  const doc = await User.findOne({ apiToken: token }).exec();
  if (!doc) return null;

  // Auto-downgrade expired VIP (same as login)
  let role = doc.role as SessionUser["role"];
  let membership = doc.membership as SessionUser["membership"];
  const expiresAt = doc.membershipExpiresAt
    ? new Date(doc.membershipExpiresAt).toISOString()
    : null;

  if (
    !isVipActive({ role, membership, membershipExpiresAt: expiresAt }) &&
    role === "vip"
  ) {
    role = "user";
    membership = "free";
    await User.updateOne(
      { _id: doc._id },
      { $set: { role: "user", membership: "free" } }
    );
  }

  return toSessionUser({
    ...doc.toObject(),
    role,
    membership,
  });
}

export async function requireAuthFromRequest(req: Request): Promise<SessionUser> {
  const user = await resolveAuthUser(req);
  if (!user) {
    throw new ApiError("请先登录，或在 URL 中提供有效的 API Token", 401);
  }
  return user;
}

export async function requireDownloadFromRequest(req: Request): Promise<SessionUser> {
  const user = await requireAuthFromRequest(req);
  if (!isVipActive(user)) {
    throw new ApiError("需要 VIP 会员才能下载（快捷指令请使用 VIP/管理员 Token）", 403);
  }
  return user;
}

export async function requireStreamFromRequest(req: Request): Promise<SessionUser> {
  const user = await requireAuthFromRequest(req);
  if (!isVipActive(user)) {
    throw new ApiError("需要 VIP 会员才能播放", 403);
  }
  return user;
}

/** Ensure user has an apiToken; create one if missing. Returns the raw token. */
export async function ensureUserApiToken(userId: string): Promise<string> {
  await connectDB();
  const existing = await User.findById(userId).select("+apiToken").exec();
  if (!existing) {
    throw new ApiError("用户不存在", 404);
  }
  if (existing.apiToken) {
    return existing.apiToken;
  }
  const token = generateApiToken();
  existing.apiToken = token;
  await existing.save();
  return token;
}

export async function regenerateUserApiToken(userId: string): Promise<string> {
  await connectDB();
  const token = generateApiToken();
  const updated = await User.findByIdAndUpdate(
    userId,
    { $set: { apiToken: token } },
    { new: true }
  )
    .select("+apiToken")
    .exec();
  if (!updated) {
    throw new ApiError("用户不存在", 404);
  }
  return token;
}
