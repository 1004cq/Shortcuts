export const dynamic = "force-dynamic";

import { connectDB } from "@/lib/db";
import { requireAuth, jsonOk, withApiHandler } from "@/lib/api";
import {
  buildPublicShortUrl,
  ensureShortlinkForMediaVaultUser,
} from "@/lib/shortlink";
import { User } from "@/models/User";

/**
 * GET /api/me/token — return the user's personal shortlink (creates one if absent).
 * The old token/download-template shape is preserved as a no-op alias for backward
 * compatibility but the primary payload is now the short URL.
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

  const shortUrl = buildPublicShortUrl(shortlink.userId);

  return jsonOk({
    shortUrl,
    shortlinkUserId: shortlink.userId,
    remainingTimes: shortlink.remainingTimes,
    usedTimes: shortlink.usedTimes,
    hasAudio: Boolean(shortlink.fileId),
    /** @deprecated kept for any older clients still reading these */
    token: null,
    canDownload: true,
    usage: null,
  });
});

/**
 * POST /api/me/token — no-op rotate kept for backward compat; returns same as GET.
 */
export const POST = GET;
