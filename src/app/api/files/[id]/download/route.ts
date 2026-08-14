export const dynamic = "force-dynamic";

import { Readable } from "stream";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { FileModel } from "@/models/File";
import { DownloadLog } from "@/models/DownloadLog";
import { getFileStats, openFileStream, resolveStoredPath } from "@/lib/storage";
import { ApiError, withApiHandler } from "@/lib/api";
import { requireDownloadFromRequest } from "@/lib/token-auth";
import {
  resolveMediaContentDisposition,
  resolveMediaContentType,
  shortlinkMediaKind,
} from "@/lib/shortlink";
import {
  compressedImageHeaders,
  ensureCompressedImage,
} from "@/lib/image-compress";

type Ctx = { params: { id: string } };

function fileToWebStream(relativePath: string) {
  const nodeStream = openFileStream(relativePath);
  return Readable.toWeb(nodeStream) as unknown as ReadableStream;
}

/**
 * GET /api/files/:id/download
 * Auth: NextAuth session OR ?token= / Authorization: Bearer (VIP/admin).
 * Images: compressed JPEG (longest edge ≤1920, ~q75, target <1MB), inline.
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

  if (shortlinkMediaKind(file) === "image") {
    try {
      const compressed = await ensureCompressedImage(file);
      const webStream = fileToWebStream(compressed.relativePath);
      return new Response(webStream, {
        status: 200,
        headers: compressedImageHeaders(compressed.filename, compressed.size),
      });
    } catch (err) {
      console.error("[download] image compress failed, serving original", err);
    }
  }

  const stats = getFileStats(file.path);
  const webStream = fileToWebStream(file.path);
  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": resolveMediaContentType(file),
      "Content-Length": String(stats.size),
      "Content-Disposition": resolveMediaContentDisposition(file),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
});
