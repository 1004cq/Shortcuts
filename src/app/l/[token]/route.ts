export const dynamic = "force-dynamic";

import { Readable } from "stream";
import { connectDB } from "@/lib/db";
import { FileModel } from "@/models/File";
import { DownloadLog } from "@/models/DownloadLog";
import { getFileStats, openFileStream, resolveStoredPath } from "@/lib/storage";
import { ApiError, withApiHandler } from "@/lib/api";
import {
  resolveMediaContentDisposition,
  resolveMediaContentType,
  shortlinkMediaKind,
} from "@/lib/shortlink";
import {
  compressedImageHeaders,
  ensureCompressedImage,
} from "@/lib/image-compress";

type Ctx = { params: { token: string } };

function fileToWebStream(relativePath: string) {
  const nodeStream = openFileStream(relativePath);
  return Readable.toWeb(nodeStream) as unknown as ReadableStream;
}

/**
 * GET /l/:shareToken
 * Permanent per-file Shortcuts download link (auto-generated on upload).
 * Images are served as compressed JPEG, not originals.
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

  if (shortlinkMediaKind(file) === "image") {
    try {
      const compressed = await ensureCompressedImage(file);
      return new Response(fileToWebStream(compressed.relativePath), {
        status: 200,
        headers: compressedImageHeaders(compressed.filename, compressed.size),
      });
    } catch (err) {
      console.error("[share] image compress failed, serving original", err);
    }
  }

  const stats = getFileStats(file.path);
  return new Response(fileToWebStream(file.path), {
    status: 200,
    headers: {
      "Content-Type": resolveMediaContentType(file),
      "Content-Length": String(stats.size),
      "Content-Disposition": resolveMediaContentDisposition(file),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=60",
    },
  });
});
