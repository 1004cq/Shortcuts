export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ShortlinkUser } from "@/models/ShortlinkUser";
import {
  buildFileDownloadRedirectUrl,
  isValidShortlinkUserId,
} from "@/lib/shortlink";

type Ctx = { params: { userId: string } };

/**
 * GET /apl/:userId
 * Fixed per-user Shortcuts short link with play-count billing.
 * Flow: find user → check remaining → deduct 1 → 302 to file download URL.
 */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const { userId } = ctx.params;

    if (!isValidShortlinkUserId(userId)) {
      return new NextResponse("用户ID无效", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    await connectDB();

    // Atomic deduct when remainingTimes >= 1
    const updated = await ShortlinkUser.findOneAndUpdate(
      { userId, remainingTimes: { $gte: 1 } },
      {
        $inc: { remainingTimes: -1, usedTimes: 1 },
        $set: { lastAccessTime: new Date() },
      },
      { new: true }
    ).exec();

    if (!updated) {
      const exists = await ShortlinkUser.exists({ userId });
      if (!exists) {
        return new NextResponse("用户不存在", {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      return new NextResponse("次数不足", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (!updated.fileId) {
      return new NextResponse("该用户未绑定音频", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const downloadUrl = await buildFileDownloadRedirectUrl(
      String(updated.fileId),
      req
    );
    return NextResponse.redirect(downloadUrl, 302);
  } catch (err) {
    console.error("[apl]", err);
    const message =
      err instanceof Error && err.message ? err.message : "服务器内部错误";
    // ApiError-style messages for missing file / token
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
