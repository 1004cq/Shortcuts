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
  isShortlinkMediaFile,
  shortlinkMediaKind,
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
  let category: string | null = null;
  let mimeType: string | null = null;
  let mediaKind: "audio" | "video" | null = null;

  if (fileId) {
    const file = await FileModel.findById(fileId)
      .select("_id name originalName category mimeType size")
      .lean();
    if (file && isShortlinkMediaFile(file)) {
      fileName = file.name || file.originalName || null;
      category = file.category || null;
      mimeType = file.mimeType || null;
      mediaKind = shortlinkMediaKind(file);
    } else {
      fileId = null;
      fileName = null;
    }
  }

  const hasMedia = Boolean(fileId);
  return {
    shortUrl: buildPublicShortUrl(shortlink.userId),
    shortlinkUserId: shortlink.userId,
    fileId,
    fileName,
    category,
    mimeType,
    mediaKind,
    remainingTimes: Number(shortlink.remainingTimes) || 0,
    usedTimes: Number(shortlink.usedTimes) || 0,
    hasMedia,
    /** @deprecated use hasMedia — kept for older clients */
    hasAudio: hasMedia,
  };
}

/** GET /api/me/shortlink — ensure + return shortlink with bound media */
export const GET = withApiHandler(async () => {
  const sessionUser = await requireAuth();
  await connectDB();
  return jsonOk({ item: await serializeForUser(sessionUser.id) });
});

const patchSchema = z.object({
  fileId: z.string().min(1, "请选择音频或视频"),
});

/**
 * PATCH /api/me/shortlink — switch bound audio/video; short URL path never changes.
 */
export const PATCH = withApiHandler(async (req: Request) => {
  const sessionUser = await requireAuth();
  await connectDB();

  const body = patchSchema.parse(await req.json());
  if (!mongoose.Types.ObjectId.isValid(body.fileId)) {
    throw new ApiError("无效的媒体文件 ID", 400);
  }

  const file = await FileModel.findById(body.fileId)
    .select("_id name originalName category mimeType isPublic")
    .lean();
  if (!file) {
    throw new ApiError("媒体文件不存在", 404);
  }
  if (!isShortlinkMediaFile(file)) {
    throw new ApiError("只能绑定音频或视频文件", 400);
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
    message: "媒体已切换，短链接不变",
  });
});
