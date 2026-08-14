export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { FileModel } from "@/models/File";
import { ShortlinkUser } from "@/models/ShortlinkUser";
import {
  buildMediaFileHeadResponse,
  buildMediaFileResponse,
  recordMediaDownload,
} from "@/lib/media-serve";
import {
  isShortlinkMediaFile,
  isValidShortlinkUserId,
} from "@/lib/shortlink";

/** Reserved /api/* segments — handled by other route handlers */
const RESERVED_API_SEGMENTS = new Set([
  "admin",
  "auth",
  "downloads",
  "files",
  "me",
  "payments",
  "subscriptions",
]);

type Ctx = { params: { userId: string } };

async function loadBoundMedia(userId: string) {
  await connectDB();

  const doc = await ShortlinkUser.findOne({ userId }).lean();
  if (!doc) {
    return { error: "用户不存在", status: 404 as const };
  }

  if (!doc.fileId) {
    return { error: "该用户未绑定音频、视频或图片", status: 404 as const };
  }

  const file = await FileModel.findById(doc.fileId);
  if (!file || !isShortlinkMediaFile(file)) {
    return { error: "绑定的媒体文件不存在", status: 404 as const };
  }

  return { doc, file };
}

/**
 * GET /api/:userId
 * Public short link with play-count billing (Shortcuts).
 * Serves media directly with correct Content-Type (no redirect).
 */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const { userId } = ctx.params;

    if (RESERVED_API_SEGMENTS.has(userId)) {
      return new NextResponse("Not Found", { status: 404 });
    }

    if (!isValidShortlinkUserId(userId)) {
      return new NextResponse("用户ID无效", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const loaded = await loadBoundMedia(userId);
    if ("error" in loaded) {
      return new NextResponse(loaded.error, {
        status: loaded.status,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const updated = await ShortlinkUser.findOneAndUpdate(
      { userId, fileId: { $ne: null }, remainingTimes: { $gte: 1 } },
      {
        $inc: { remainingTimes: -1, usedTimes: 1 },
        $set: { lastAccessTime: new Date() },
      },
      { new: true }
    ).exec();

    if (!updated) {
      return new NextResponse("次数不足", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const logUserId = updated.linkedUserId || loaded.file.uploadedBy;
    await recordMediaDownload(loaded.file, {
      userId: logUserId,
      req,
      userAgentFallback: "shortlink",
    });

    return buildMediaFileResponse(loaded.file);
  } catch (err) {
    console.error("[api-shortlink]", err);
    const message =
      err instanceof Error && err.message ? err.message : "服务器内部错误";
    const status =
      typeof err === "object" &&
      err &&
      "status" in err &&
      typeof (err as { status: unknown }).status === "number"
        ? (err as { status: number }).status
        : 500;
    return new NextResponse(status === 500 ? "服务器内部错误" : message, {
      status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

/**
 * HEAD /api/:userId — type probe for Shortcuts (no billing, no body).
 */
export async function HEAD(_req: Request, ctx: Ctx) {
  try {
    const { userId } = ctx.params;

    if (RESERVED_API_SEGMENTS.has(userId)) {
      return new NextResponse(null, { status: 404 });
    }

    if (!isValidShortlinkUserId(userId)) {
      return new NextResponse(null, { status: 400 });
    }

    const loaded = await loadBoundMedia(userId);
    if ("error" in loaded) {
      return new NextResponse(null, { status: loaded.status });
    }

    return buildMediaFileHeadResponse(loaded.file);
  } catch (err) {
    console.error("[api-shortlink-head]", err);
    return new NextResponse(null, { status: 500 });
  }
}
