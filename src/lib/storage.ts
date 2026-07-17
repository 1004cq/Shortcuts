import fs from "fs/promises";
import path from "path";
import { createReadStream, existsSync, mkdirSync, statSync } from "fs";
import { nanoid } from "nanoid";
import { sanitizeFilename } from "@/lib/utils";

/**
 * Local disk storage under UPLOAD_DIR (default: ./uploads).
 * Swap this module later for S3 / OSS without changing API routes.
 */

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

export function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  return UPLOAD_DIR;
}

export function resolveStoredPath(relativePath: string): string {
  // Prevent path traversal — only allow files inside UPLOAD_DIR
  const root = path.resolve(ensureUploadDir());
  const absolute = path.resolve(root, relativePath);
  if (!absolute.startsWith(root + path.sep) && absolute !== root) {
    throw new Error("Invalid file path");
  }
  return absolute;
}

export async function saveUploadedFile(
  file: File,
  subdir = "media"
): Promise<{ relativePath: string; size: number; mimeType: string; originalName: string }> {
  const root = ensureUploadDir();
  const folder = path.join(root, subdir);
  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true });
  }

  const originalName = sanitizeFilename(file.name || "unnamed");
  const ext = path.extname(originalName);
  const storedName = `${Date.now()}-${nanoid(10)}${ext}`;
  const absolute = path.join(folder, storedName);
  const relativePath = path.join(subdir, storedName).replace(/\\/g, "/");

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolute, buffer);

  return {
    relativePath,
    size: buffer.length,
    mimeType: file.type || "application/octet-stream",
    originalName,
  };
}

export async function deleteStoredFile(relativePath: string) {
  try {
    const absolute = resolveStoredPath(relativePath);
    await fs.unlink(absolute);
  } catch {
    // ignore missing files
  }
}

export function getFileStats(relativePath: string) {
  const absolute = resolveStoredPath(relativePath);
  return statSync(absolute);
}

export function openFileStream(relativePath: string, start?: number, end?: number) {
  const absolute = resolveStoredPath(relativePath);
  return createReadStream(absolute, start !== undefined ? { start, end } : undefined);
}

export { UPLOAD_DIR };
