export const dynamic = "force-dynamic";

import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { FileModel } from "@/models/File";
import { resolveStoredPath } from "@/lib/storage";
import { ApiError, withApiHandler } from "@/lib/api";
import { requireDownloadFromRequest } from "@/lib/token-auth";
import { buildMediaFileResponse, recordMediaDownload } from "@/lib/media-serve";

type Ctx = { params: { id: string } };

/**
 * GET /api/files/:id/download
 * Auth: NextAuth session OR ?token= / Authorization: Bearer (VIP/admin).
 * Images: compressed JPEG (longest edge ≤1920, ~q75, target <1MB), inline.
 */
export const GET = withApiHandler(async (req: Request, ctx: unknown) => {
  const user = await requireDownloadFromRequest(req);
  const { id } = (ctx as Ctx).params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError("无效的文件 ID", 400);
  }

  await connectDB();
  const file = await FileModel.findById(id);
  if (!file) {
    throw new ApiError("文件不存在", 404);
  }

  resolveStoredPath(file.path);

  await recordMediaDownload(file, { userId: user.id, req });

  return buildMediaFileResponse(file);
});
