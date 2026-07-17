export const dynamic = "force-dynamic";

import { Readable } from "stream";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { FileModel } from "@/models/File";
import { DownloadLog } from "@/models/DownloadLog";
import { getFileStats, openFileStream, resolveStoredPath } from "@/lib/storage";
import { ApiError, withApiHandler } from "@/lib/api";
import { requireDownloadFromRequest } from "@/lib/token-auth";

type Ctx = { params: { id: string } };

/**
 * GET /api/files/:id/download
 * Auth: NextAuth session OR ?token= / Authorization: Bearer (VIP/admin).
 * Designed for Apple Shortcuts «获取 URL 内容».
 */
export const GET = withApiHandler(async (req: Request, ctx: unknown) => {
  const user = await requireDownloadFromRequest(req);
  const { id } = (ctx as Ctx).params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError("无效的文件 ID", 400);
  }

  await connectDB();
  const file = await FileModel.findById(id);
  if (!file) {
    throw new ApiError("文件不存在", 404);
  }

  resolveStoredPath(file.path);
  const stats = getFileStats(file.path);
  const nodeStream = openFileStream(file.path);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  await Promise.all([
    FileModel.updateOne({ _id: id }, { $inc: { downloadCount: 1 } }),
    DownloadLog.create({
      userId: user.id,
      fileId: file._id,
      action: "download",
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        null,
      userAgent: req.headers.get("user-agent")?.slice(0, 512) || null,
    }),
  ]);

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Length": String(stats.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "Cache-Control": "private, no-store",
    },
  });
});
