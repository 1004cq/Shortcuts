export const dynamic = "force-dynamic";

import { Readable } from "stream";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { FileModel } from "@/models/File";
import { getFileStats, openFileStream, resolveStoredPath } from "@/lib/storage";
import { ApiError, withApiHandler } from "@/lib/api";
import { requireAuthFromRequest } from "@/lib/token-auth";
import { isShortlinkMediaFile, shortlinkMediaKind } from "@/lib/shortlink";

type Ctx = { params: { id: string } };

/**
 * GET /api/files/:id/preview
 * Lightweight media thumbnail / image preview for grid lazy-load.
 * - Images: serve the image file
 * - Videos with thumbnailPath: serve stored cover
 * - No DownloadLog (unlike /stream) — safe for many in-viewport thumbs
 */
export const GET = withApiHandler(async (req: Request, ctx: unknown) => {
  await requireAuthFromRequest(req);
  const { id } = (ctx as Ctx).params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError("无效的文件 ID", 400);
  }

  await connectDB();
  const file = await FileModel.findById(id)
    .select("path thumbnailPath category mimeType name")
    .lean();
  if (!file) {
    throw new ApiError("文件不存在", 404);
  }
  if (!isShortlinkMediaFile(file)) {
    throw new ApiError("不支持预览该文件类型", 400);
  }

  const kind = shortlinkMediaKind(file);
  let relativePath: string | null = null;
  let contentType = file.mimeType || "application/octet-stream";

  if (kind === "image") {
    relativePath = file.path;
  } else if (kind === "video" && file.thumbnailPath) {
    relativePath = String(file.thumbnailPath);
    contentType = "image/jpeg";
  } else {
    throw new ApiError("暂无可用缩略图", 404);
  }

  if (!relativePath) {
    throw new ApiError("暂无可用缩略图", 404);
  }

  resolveStoredPath(relativePath);
  const stats = getFileStats(relativePath);
  const nodeStream = openFileStream(relativePath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stats.size),
      "Accept-Ranges": "bytes",
      // Short private cache — avoids refetch while scrolling grids
      "Cache-Control": "private, max-age=300",
    },
  });
});
