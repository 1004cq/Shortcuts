import { Readable } from "stream";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { FileModel } from "@/models/File";
import { DownloadLog } from "@/models/DownloadLog";
import { getFileStats, openFileStream } from "@/lib/storage";
import {
  resolveMediaContentDisposition,
  resolveMediaContentType,
  shortlinkMediaKind,
} from "@/lib/shortlink";
import {
  compressedImageHeaders,
  ensureCompressedImage,
  jpegDownloadName,
} from "@/lib/image-compress";

type MediaFile = {
  _id: mongoose.Types.ObjectId | { toString(): string };
  path: string;
  thumbnailPath?: string | null;
  category?: string | null;
  mimeType?: string | null;
  originalName?: string | null;
  name?: string | null;
};

export function fileToWebStream(relativePath: string) {
  const nodeStream = openFileStream(relativePath);
  return Readable.toWeb(nodeStream) as unknown as ReadableStream;
}

function mediaCacheControl(kind: ReturnType<typeof shortlinkMediaKind>): string {
  if (kind === "image") return "private, max-age=120";
  if (kind === "video" || kind === "audio") return "private, max-age=60";
  return "private, no-store";
}

function audioVideoExtraHeaders(
  kind: ReturnType<typeof shortlinkMediaKind>
): Record<string, string> {
  if (kind === "video" || kind === "audio") {
    return { "Accept-Ranges": "bytes" };
  }
  return {};
}

/**
 * Headers for HEAD — type/disposition only, no compression work.
 * Shortcuts uses Content-Type to branch audio vs video/image.
 */
export function buildMediaMetadataHeaders(file: MediaFile): Record<string, string> {
  const kind = shortlinkMediaKind(file);
  if (kind === "image") {
    const filename = jpegDownloadName(file);
    const encoded = encodeURIComponent(filename);
    return {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `inline; filename*=UTF-8''${encoded}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": mediaCacheControl(kind),
    };
  }

  const contentType = resolveMediaContentType(file);
  return {
    "Content-Type": contentType,
    "Content-Disposition": resolveMediaContentDisposition(file),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": mediaCacheControl(kind),
    ...audioVideoExtraHeaders(kind),
  };
}

async function resolveMediaServePlan(file: MediaFile): Promise<{
  relativePath: string;
  headers: Record<string, string>;
}> {
  const kind = shortlinkMediaKind(file);

  if (kind === "image") {
    try {
      const compressed = await ensureCompressedImage(file);
      return {
        relativePath: compressed.relativePath,
        headers: compressedImageHeaders(compressed.filename, compressed.size),
      };
    } catch (err) {
      console.error("[media-serve] image compress failed, serving original", err);
    }
  }

  const stats = getFileStats(file.path);
  const contentType = resolveMediaContentType(file);
  return {
    relativePath: file.path,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stats.size),
      "Content-Disposition": resolveMediaContentDisposition(file),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": mediaCacheControl(kind),
      ...audioVideoExtraHeaders(kind),
    },
  };
}

/** Stream a media file with Safari / Shortcuts-friendly headers. */
export async function buildMediaFileResponse(file: MediaFile): Promise<Response> {
  const plan = await resolveMediaServePlan(file);
  return new Response(fileToWebStream(plan.relativePath), {
    status: 200,
    headers: plan.headers,
  });
}

/** HEAD response — metadata headers only (no body, no compression). */
export function buildMediaFileHeadResponse(file: MediaFile): Response {
  return new Response(null, {
    status: 200,
    headers: buildMediaMetadataHeaders(file),
  });
}

type DownloadLogOpts = {
  userId: string | mongoose.Types.ObjectId;
  req: Request;
  action?: "download" | "stream" | "preview";
  userAgentFallback?: string;
};

/** Increment download count and append a log row (fire-and-forget safe). */
export async function recordMediaDownload(
  file: MediaFile,
  opts: DownloadLogOpts
): Promise<void> {
  await Promise.all([
    FileModel.updateOne({ _id: file._id }, { $inc: { downloadCount: 1 } }),
    DownloadLog.create({
      userId: opts.userId,
      fileId: file._id,
      action: opts.action || "download",
      ipAddress:
        opts.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        opts.req.headers.get("x-real-ip") ||
        null,
      userAgent:
        opts.req.headers.get("user-agent")?.slice(0, 512) ||
        opts.userAgentFallback ||
        null,
    }),
  ]);
}

/** Pre-generate compressed JPEG after bind so first shortlink hit is fast. */
export function prewarmShortlinkMedia(fileId: string): void {
  void (async () => {
    try {
      if (!mongoose.Types.ObjectId.isValid(fileId)) return;
      await connectDB();
      const file = await FileModel.findById(fileId);
      if (!file || shortlinkMediaKind(file) !== "image") return;
      await ensureCompressedImage(file);
    } catch (err) {
      console.error("[prewarm] image compress failed", err);
    }
  })();
}
