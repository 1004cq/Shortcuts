export const dynamic = "force-dynamic";

import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { FileModel } from "@/models/File";
import { ApiError, jsonOk, requireAuth, withApiHandler } from "@/lib/api";
import { buildShareUrl, generateShareToken } from "@/lib/utils";

type Ctx = { params: { id: string } };

/**
 * GET /api/files/:id/shortcut
 * Returns this file's permanent Shortcuts URL (auto-created shareToken).
 */
export const GET = withApiHandler(async (_req: Request, ctx: unknown) => {
  await requireAuth();
  const { id } = (ctx as Ctx).params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError("无效的文件 ID", 400);
  }

  await connectDB();
  const file = await FileModel.findById(id);
  if (!file) {
    throw new ApiError("文件不存在", 404);
  }

  if (!file.shareToken) {
    file.shareToken = generateShareToken();
    await file.save();
  }

  const shortcutUrl = buildShareUrl(file.shareToken);

  return jsonOk({
    fileId: id,
    fileName: file.name,
    originalName: file.originalName,
    shareToken: file.shareToken,
    shortcutUrl,
    downloadUrl: shortcutUrl,
    streamUrl: shortcutUrl,
  });
});
