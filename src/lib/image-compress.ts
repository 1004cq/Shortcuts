import { existsSync } from "fs";
import sharp from "sharp";
import { FileModel } from "@/models/File";
import {
  getFileStats,
  resolveStoredPath,
  saveBufferFile,
} from "@/lib/storage";
import { shortlinkMediaKind } from "@/lib/shortlink";

/** Longest edge for Shortcuts / Safari preview (fast but still sharp on phone). */
const MAX_EDGE = 1920;
const FALLBACK_EDGE = 1280;
const TARGET_MAX_BYTES = 1024 * 1024;
const CACHE_VERSION = "v1";

type CompressableFile = {
  _id: { toString(): string };
  path: string;
  thumbnailPath?: string | null;
  category?: string | null;
  mimeType?: string | null;
  originalName?: string | null;
  name?: string | null;
};

const inflight = new Map<string, Promise<{ relativePath: string; size: number }>>();

function isImageFile(file: CompressableFile): boolean {
  return shortlinkMediaKind(file) === "image";
}

function cacheRelativePath(fileId: string): string {
  return `previews/${fileId}-short-${CACHE_VERSION}.jpg`;
}

export function jpegDownloadName(file: CompressableFile): string {
  const raw = String(file.originalName || file.name || "image").replace(
    /\.[^.]+$/,
    ""
  );
  const base = raw.trim() || "image";
  return `${base}.jpg`;
}

async function encodeJpeg(
  inputPath: string,
  maxEdge: number,
  quality: number
): Promise<Buffer> {
  return sharp(inputPath, { failOn: "none", sequentialRead: true })
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality,
      mozjpeg: true,
      chromaSubsampling: "4:2:0",
    })
    .toBuffer();
}

async function compressToTarget(inputPath: string): Promise<Buffer> {
  const attempts: Array<{ edge: number; quality: number }> = [
    { edge: MAX_EDGE, quality: 75 },
    { edge: FALLBACK_EDGE, quality: 75 },
    { edge: FALLBACK_EDGE, quality: 65 },
    { edge: FALLBACK_EDGE, quality: 55 },
  ];

  let last: Buffer | null = null;
  for (const { edge, quality } of attempts) {
    last = await encodeJpeg(inputPath, edge, quality);
    if (last.length <= TARGET_MAX_BYTES) return last;
  }
  return last!;
}

async function cachedFileUsable(relativePath: string | null | undefined) {
  if (!relativePath) return null;
  try {
    const absolute = resolveStoredPath(relativePath);
    if (!existsSync(absolute)) return null;
    const stats = getFileStats(relativePath);
    if (stats.size < 32) return null;
    return { relativePath, size: stats.size };
  } catch {
    return null;
  }
}

/**
 * Ensure a compressed JPEG exists for an image file (disk cache).
 * Original is never overwritten. Concurrent first-hits share one job.
 */
export async function ensureCompressedImage(
  file: CompressableFile
): Promise<{ relativePath: string; size: number; filename: string }> {
  const filename = jpegDownloadName(file);
  if (!isImageFile(file)) {
    throw new Error("not an image");
  }

  const id = String(file._id);
  const expected = cacheRelativePath(id);

  const existing =
    (await cachedFileUsable(expected)) ||
    (file.thumbnailPath?.includes(`-short-${CACHE_VERSION}.jpg`)
      ? await cachedFileUsable(file.thumbnailPath)
      : null);
  if (existing) {
    return { ...existing, filename };
  }

  let job = inflight.get(id);
  if (!job) {
    job = (async () => {
      const inputAbs = resolveStoredPath(file.path);
      const buffer = await compressToTarget(inputAbs);
      const saved = await saveBufferFile(buffer, {
        subdir: "previews",
        filename: `${id}-short-${CACHE_VERSION}.jpg`,
      });
      await FileModel.updateOne(
        { _id: file._id },
        { $set: { thumbnailPath: saved.relativePath } }
      );
      return { relativePath: saved.relativePath, size: saved.size };
    })();
    inflight.set(id, job);
    void job.finally(() => inflight.delete(id));
  }

  const result = await job;
  return { ...result, filename };
}

export function compressedImageHeaders(filename: string, size: number) {
  const encoded = encodeURIComponent(filename || "image.jpg");
  return {
    "Content-Type": "image/jpeg",
    "Content-Length": String(size),
    "Content-Disposition": `inline; filename*=UTF-8''${encoded}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=120",
  };
}
