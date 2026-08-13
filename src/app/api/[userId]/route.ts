export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ShortlinkUser } from "@/models/ShortlinkUser";
import {
  buildFileDownloadRedirectUrl,
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

/**
 * GET /api/:userId
 * Public short link with play-count billing (Shortcuts).
 * Flow: find user → require bound media → check remaining → deduct 1 → 302 to download.
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

    await connectDB();

    const doc = await ShortlinkUser.findOne({ userId }).lean();
    if (!doc) {
      return new NextResponse("用户不存在", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (!doc.fileId) {
      return new NextResponse("该用户未绑定音频、视频或图片", {
        status: 404,
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

    const downloadUrl = await buildFileDownloadRedirectUrl(
      String(updated.fileId),
      req
    );
    return NextResponse.redirect(downloadUrl, 302);
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
