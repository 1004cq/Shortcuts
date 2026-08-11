export const dynamic = "force-dynamic";

import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { FileModel } from "@/models/File";
import { User } from "@/models/User";
import { ShortlinkUser } from "@/models/ShortlinkUser";
import {
  ApiError,
  jsonOk,
  requireAuth,
  withApiHandler,
} from "@/lib/api";
import {
  buildPublicShortUrl,
  ensureShortlinkForMediaVaultUser,
} from "@/lib/shortlink";

async function serializeForUser(mediaVaultUserId: string) {
  const user = await User.findById(mediaVaultUserId).lean();
  const shortlink = await ensureShortlinkForMediaVaultUser({
    mediaVaultUserId,
    username: user?.username,
    name: user?.name,
  });

  let fileName: string | null = null;
  let fileId: string | null = shortlink.fileId ? String(shortlink.fileId) : null;
  if (fileId) {
    const file = await FileModel.findById(fileId)
      .select("_id name originalName category mimeType size")
      .lean();
    if (file) {
      fileName = file.name || file.originalName || null;
    } else {
      fileId = null;
      fileName = null;
    }
  }

  return {
    shortUrl: buildPublicShortUrl(shortlink.userId),
    shortlinkUserId: shortlink.userId,
    fileId,
    fileName,
    remainingTimes: Number(shortlink.remainingTimes) || 0,
    usedTimes: Number(shortlink.usedTimes) || 0,
    hasAudio: Boolean(fileId),
  };
}

/** GET /api/me/shortlink — ensure + return shortlink with bound audio */
export const GET = withApiHandler(async () => {
  const sessionUser = await requireAuth();
  await connectDB();
  return jsonOk({ item: await serializeForUser(sessionUser.id) });
});

const patchSchema = z.object({
  fileId: z.string().min(1, "请选择音频"),
});

/**
 * PATCH /api/me/shortlink — switch bound audio; short URL path never changes.
 */
export const PATCH = withApiHandler(async (req: Request) => {
  const sessionUser = await requireAuth();
  await connectDB();

  const body = patchSchema.parse(await req.json());
  if (!mongoose.Types.ObjectId.isValid(body.fileId)) {
    throw new ApiError("无效的音频文件 ID", 400);
  }

  const file = await FileModel.findById(body.fileId)
    .select("_id name originalName category mimeType isPublic")
    .lean();
  if (!file) {
    throw new ApiError("音频文件不存在", 404);
  }
  const isAudio =
    file.category === "audio" ||
    String(file.mimeType || "").startsWith("audio/");
  if (!isAudio) {
    throw new ApiError("只能绑定音频文件", 400);
  }

  const user = await User.findById(sessionUser.id).lean();
  await ensureShortlinkForMediaVaultUser({
    mediaVaultUserId: sessionUser.id,
    username: user?.username,
    name: user?.name,
  });

  const doc = await ShortlinkUser.findOne({
    linkedUserId: new mongoose.Types.ObjectId(sessionUser.id),
  });
  if (!doc) {
    throw new ApiError("短链接尚未分配", 404);
  }

  doc.fileId = new mongoose.Types.ObjectId(body.fileId);
  await doc.save();

  return jsonOk({
    item: await serializeForUser(sessionUser.id),
    message: "音频已切换，短链接不变",
  });
});
