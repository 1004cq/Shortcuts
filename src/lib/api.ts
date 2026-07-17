import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  canDownload,
  canManageUsers,
  canStream,
  canUpload,
} from "@/lib/permissions";
import type { SessionUser } from "@/types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function getAuthUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as SessionUser | undefined) ?? null;
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new ApiError("请先登录", 401);
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth();
  if (!canManageUsers(user)) {
    throw new ApiError("需要管理员权限", 403);
  }
  return user;
}

export async function requireDownloadPermission(): Promise<SessionUser> {
  const user = await requireAuth();
  if (!canDownload(user)) {
    throw new ApiError("需要 VIP 会员才能下载", 403);
  }
  return user;
}

export async function requireStreamPermission(): Promise<SessionUser> {
  const user = await requireAuth();
  if (!canStream(user)) {
    throw new ApiError("需要 VIP 会员才能在线播放", 403);
  }
  return user;
}

export async function requireUploadPermission(): Promise<SessionUser> {
  const user = await requireAuth();
  if (!canUpload(user)) {
    throw new ApiError("需要管理员权限才能上传", 403);
  }
  return user;
}

/** Wrap route handlers with consistent error responses */
export function withApiHandler(
  handler: (req: Request, ctx?: unknown) => Promise<Response>
) {
  return async (req: Request, ctx?: unknown) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return jsonError(err.message, err.status);
      }
      console.error("[API]", err);
      return jsonError("服务器内部错误", 500);
    }
  };
}
