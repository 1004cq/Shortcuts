export const dynamic = "force-dynamic";

import { connectDB } from "@/lib/db";
import { requireAuth, jsonOk, withApiHandler } from "@/lib/api";
import {
  buildPublicShortUrl,
  ensureShortlinkForMediaVaultUser,
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
  const fileId = shortlink.fileId ? String(shortlink.fileId) : null;
  if (fileId) {
    const file = await FileModel.findById(fileId)
      .select("name originalName")
      .lean();
    fileName = file?.name || file?.originalName || null;
  }

  return jsonOk({
    shortUrl: buildPublicShortUrl(shortlink.userId),
    shortlinkUserId: shortlink.userId,
    fileId,
    fileName,
    remainingTimes: shortlink.remainingTimes,
    usedTimes: shortlink.usedTimes,
    hasAudio: Boolean(fileId),
    token: null,
    canDownload: true,
    usage: null,
  });
});

/** POST /api/me/token — same as GET */
export const POST = GET;
