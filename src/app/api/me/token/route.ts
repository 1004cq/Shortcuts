export const dynamic = "force-dynamic";

import { requireAuth, jsonOk, withApiHandler } from "@/lib/api";
import {
  ensureUserApiToken,
  regenerateUserApiToken,
} from "@/lib/token-auth";
import { getAppUrl } from "@/lib/utils";
import { canDownload } from "@/lib/permissions";

/**
 * GET /api/me/token — return (or create) personal API token for Shortcuts.
 */
export const GET = withApiHandler(async () => {
  const user = await requireAuth();
  const token = await ensureUserApiToken(user.id);
  const base = getAppUrl().replace(/\/$/, "");

  return jsonOk({
    token,
    canDownload: canDownload(user),
    usage: {
      download: `${base}/api/files/{fileId}/download?token=${token}`,
      stream: `${base}/api/files/{fileId}/stream?token=${token}`,
      header: `Authorization: Bearer ${token}`,
    },
    shortcutsHint:
      "在「获取 URL 内容」中填写 download 地址，把 {fileId} 换成文件详情页 URL 末尾的 ID。",
  });
});

/**
 * POST /api/me/token — rotate token (invalidates the previous one).
 */
export const POST = withApiHandler(async () => {
  const user = await requireAuth();
  const token = await regenerateUserApiToken(user.id);
  const base = getAppUrl().replace(/\/$/, "");

  return jsonOk({
    token,
    canDownload: canDownload(user),
    usage: {
      download: `${base}/api/files/{fileId}/download?token=${token}`,
      stream: `${base}/api/files/{fileId}/stream?token=${token}`,
      header: `Authorization: Bearer ${token}`,
    },
    message: "Token 已重新生成，旧 Token 立即失效",
  });
});
