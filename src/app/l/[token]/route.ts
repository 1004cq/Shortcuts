export const dynamic = "force-dynamic";

import { connectDB } from "@/lib/db";
import { FileModel } from "@/models/File";
import { resolveStoredPath } from "@/lib/storage";
import { ApiError, withApiHandler } from "@/lib/api";
import { buildMediaFileResponse, recordMediaDownload } from "@/lib/media-serve";

type Ctx = { params: { token: string } };

/**
 * GET /l/:shareToken
 * Permanent per-file Shortcuts download link (auto-generated on upload).
 * Images are served as compressed JPEG, not originals.
 */
export const GET = withApiHandler(async (req: Request, ctx: unknown) => {
  const { token } = (ctx as Ctx).params;
  if (!token || token.length < 8) {
    throw new ApiError("无效的分享链接", 400);
  }

  await connectDB();
  const file = await FileModel.findOne({ shareToken: token });
  if (!file) {
    throw new ApiError("文件不存在或链接已失效", 404);
  }

  resolveStoredPath(file.path);

  await recordMediaDownload(file, {
    userId: file.uploadedBy,
    req,
    userAgentFallback: "shortcuts-share",
  });

  return buildMediaFileResponse(file);
});
