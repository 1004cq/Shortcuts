export const dynamic = "force-dynamic";

import { connectDB } from "@/lib/db";
import { requireAuth, jsonOk, withApiHandler } from "@/lib/api";
import {
  buildPublicShortUrl,
  ensureShortlinkForMediaVaultUser,
  isShortlinkMediaFile,
  shortlinkMediaKind,
  type ShortlinkMediaKind,
} from "@/lib/shortlink";
import { User } from "@/models/User";
import { FileModel } from "@/models/File";

/**
 * GET /api/me/token — alias of shortlink payload (creates one if absent).
 */
export const GET = withApiHandler(async () => {
  const sessionUser = await requireAuth();
  await connectDB();

  const user = await User.findById(sessionUser.id).lean();
  const shortlink = await ensureShortlinkForMediaVaultUser({
    mediaVaultUserId: sessionUser.id,
    username: user?.username,
    name: user?.name,
  });

  let fileName: string | null = null;
  let fileId: string | null = shortlink.fileId ? String(shortlink.fileId) : null;
  let mediaKind: ShortlinkMediaKind | null = null;
  if (fileId) {
    const file = await FileModel.findById(fileId)
      .select("name originalName category mimeType")
      .lean();
    if (file && isShortlinkMediaFile(file)) {
      fileName = file.name || file.originalName || null;
      mediaKind = shortlinkMediaKind(file);
    } else {
      fileId = null;
    }
  }

  const hasMedia = Boolean(fileId);
  return jsonOk({
    shortUrl: buildPublicShortUrl(shortlink.userId),
    shortlinkUserId: shortlink.userId,
    fileId,
    fileName,
    mediaKind,
    remainingTimes: shortlink.remainingTimes,
    usedTimes: shortlink.usedTimes,
    hasMedia,
    hasAudio: hasMedia,
    token: null,
    canDownload: true,
    usage: null,
  });
});

/** POST /api/me/token — same as GET */
export const POST = GET;
