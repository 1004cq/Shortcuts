export const dynamic = "force-dynamic";

import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { FileModel } from "@/models/File";
import { ApiError, jsonOk, withApiHandler } from "@/lib/api";
import { requireDownloadFromRequest, ensureUserApiToken } from "@/lib/token-auth";
import { getAppUrl } from "@/lib/utils";

type Ctx = { params: { id: string } };

/**
 * GET /api/files/:id/shortcut
 * Returns the ready-to-paste Apple Shortcuts URL for THIS file
 * (includes the caller's personal API token).
 */
export const GET = withApiHandler(async (req: Request, ctx: unknown) => {
  const user = await requireDownloadFromRequest(req);
  const { id } = (ctx as Ctx).params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError("无效的文件 ID", 400);
  }

  await connectDB();
  const file = await FileModel.findById(id).lean();
  if (!file) {
    throw new ApiError("文件不存在", 404);
  }

  const token = await ensureUserApiToken(user.id);
  const base = getAppUrl().replace(/\/$/, "");
  const downloadUrl = `${base}/api/files/${id}/download?token=${encodeURIComponent(token)}`;
  const streamUrl = `${base}/api/files/${id}/stream?token=${encodeURIComponent(token)}`;
  const shortUrl = `${base}/s/${id}?token=${encodeURIComponent(token)}`;

  return jsonOk({
    fileId: id,
    fileName: file.name,
    originalName: file.originalName,
    category: file.category,
    mimeType: file.mimeType,
    downloadUrl,
    streamUrl,
    /** Short alias that redirects to download — easiest for Shortcuts */
    shortcutUrl: shortUrl,
  });
});
