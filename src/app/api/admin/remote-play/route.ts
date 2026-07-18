export const dynamic = "force-dynamic";

import { z } from "zod";
import { ApiError, jsonOk, requireAdmin, withApiHandler } from "@/lib/api";
import { getAppUrl } from "@/lib/utils";

const bodySchema = z.object({
  userId: z.string().trim().min(1).max(64),
  audioUrl: z.string().url().max(2048).optional(),
  fileId: z.string().trim().min(1).optional(),
  token: z.string().trim().min(1).optional(),
  title: z.string().trim().max(120).optional(),
  volume: z.number().min(0).max(1).optional(),
});

/**
 * Admin → remote-audio-push bridge.
 * POST { userId, audioUrl } or { userId, fileId, token } to push play.
 */
export const POST = withApiHandler(async (req: Request) => {
  await requireAdmin();

  const base = (process.env.REMOTE_AUDIO_URL || `${getAppUrl()}/realtime`).replace(
    /\/$/,
    ""
  );
  const auth = process.env.REMOTE_AUDIO_TOKEN || "";
  if (!auth) {
    throw new ApiError("未配置 REMOTE_AUDIO_TOKEN", 503);
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    throw new ApiError(parsed.error.issues[0]?.message || "参数无效", 400);
  }

  let audioUrl = parsed.data.audioUrl;
  if (!audioUrl) {
    if (!parsed.data.fileId || !parsed.data.token) {
      throw new ApiError("需要 audioUrl，或同时提供 fileId + token", 400);
    }
    const app = getAppUrl().replace(/\/$/, "");
    audioUrl = `${app}/api/files/${parsed.data.fileId}/stream?token=${encodeURIComponent(parsed.data.token)}`;
  }

  const res = await fetch(`${base}/api/play`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-auth-token": auth,
    },
    body: JSON.stringify({
      userId: parsed.data.userId,
      audioUrl,
      title: parsed.data.title,
      volume: parsed.data.volume,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || "远程播放服务失败", res.status);
  }

  return jsonOk(data);
});
