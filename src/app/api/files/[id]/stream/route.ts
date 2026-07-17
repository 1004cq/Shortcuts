export const dynamic = "force-dynamic";

import { Readable } from "stream";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { FileModel } from "@/models/File";
import { DownloadLog } from "@/models/DownloadLog";
import { getFileStats, openFileStream, resolveStoredPath } from "@/lib/storage";
import { ApiError, withApiHandler } from "@/lib/api";
import { requireStreamFromRequest } from "@/lib/token-auth";

type Ctx = { params: { id: string } };

/**
 * GET /api/files/:id/stream
 * Auth: session OR API token (?token= / Bearer). Supports HTTP Range.
 */
export const GET = withApiHandler(async (req: Request, ctx: unknown) => {
  const user = await requireStreamFromRequest(req);
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
  const fileSize = stats.size;
  const range = req.headers.get("range");

  const shouldLog =
    !range || range.toLowerCase().includes("bytes=0-") || range === "bytes=0-";

  if (shouldLog) {
    await DownloadLog.create({
      userId: user.id,
      fileId: file._id,
      action: "stream",
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        null,
      userAgent: req.headers.get("user-agent")?.slice(0, 512) || null,
    });
  }

  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (!match) {
      throw new ApiError("无效的 Range 头", 416);
    }
    const start = parseInt(match[1], 10);
    const end = match[2]
      ? parseInt(match[2], 10)
      : Math.min(start + 1024 * 1024 - 1, fileSize - 1);

    if (start >= fileSize || end >= fileSize || start > end) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const chunkSize = end - start + 1;
    const nodeStream = openFileStream(file.path, start, end);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

    return new Response(webStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": file.mimeType,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const nodeStream = openFileStream(file.path);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Length": String(fileSize),
      "Content-Type": file.mimeType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
    },
  });
});
