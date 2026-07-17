export const dynamic = "force-dynamic";

import { Readable } from "stream";
import { connectDB } from "@/lib/db";
import { FileModel } from "@/models/File";
import { DownloadLog } from "@/models/DownloadLog";
import { getFileStats, openFileStream, resolveStoredPath } from "@/lib/storage";
import { ApiError, withApiHandler } from "@/lib/api";

type Ctx = { params: { token: string } };

/**
 * GET /l/:shareToken
 * Permanent per-file Shortcuts download link (auto-generated on upload).
 * No login / user API token required — possession of the unguessable token is auth.
 */
export const GET = withApiHandler(async (req: Request, ctx: unknown) => {
  const { token } = (ctx as Ctx).params;
  if (!token || token.length < 8) {
    throw new ApiError("无效的分享链接", 400);
  }

  await connectDB();
  const file = await FileModel.findOne({ shareToken: token });
  if (!file) {
    throw new ApiError("文件不存在或链接已失效", 404);
  }

  resolveStoredPath(file.path);
  const stats = getFileStats(file.path);
  const nodeStream = openFileStream(file.path);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  await Promise.all([
    FileModel.updateOne({ _id: file._id }, { $inc: { downloadCount: 1 } }),
    DownloadLog.create({
      userId: file.uploadedBy,
      fileId: file._id,
      action: "download",
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        null,
      userAgent: (req.headers.get("user-agent") || "shortcuts-share").slice(0, 512),
    }),
  ]);

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Length": String(stats.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "Cache-Control": "private, max-age=60",
    },
  });
});
