export const dynamic = "force-dynamic";

import { z } from "zod";
import { connectDB } from "@/lib/db";
import { FileModel } from "@/models/File";
import { ApiError, jsonOk, requireAdmin, withApiHandler } from "@/lib/api";
import { generateShareToken, getAppUrl } from "@/lib/utils";
import {
  buildReceiverUrl,
  getRemoteAudioAdminToken,
  getRemoteAudioBase,
  getRemoteAudioReceiverToken,
  remoteAudioFetch,
} from "@/lib/remote-audio";

/**
 * GET /api/admin/remote-play
 * Dashboard bootstrap: health, online receivers, receiver link template.
 */
export const GET = withApiHandler(async () => {
  await requireAdmin();

  const configured = Boolean(getRemoteAudioAdminToken());
  let health: Record<string, unknown> | null = null;
  let online: unknown[] = [];
  let serviceError = "";

  if (configured) {
    try {
      const [hRes, oRes] = await Promise.all([
        fetch(`${getRemoteAudioBase()}/health`, { cache: "no-store" }),
        remoteAudioFetch("/api/online"),
      ]);
      health = await hRes.json().catch(() => null);
      if (oRes.ok) {
        const data = await oRes.json();
        online = data.items || [];
      } else {
        serviceError = "无法读取在线列表（检查 ADMIN_TOKEN 是否一致）";
      }
    } catch (e) {
      serviceError = e instanceof Error ? e.message : "远程音频服务不可达";
    }
  }

  return jsonOk({
    configured,
    serviceError,
    health,
    online,
    publicUrl: getRemoteAudioBase(),
    receiverTokenConfigured: Boolean(getRemoteAudioReceiverToken()),
    // Example only — real links built per userId on the client via /link
    receiverUrlExample: buildReceiverUrl("{userId}"),
  });
});

const postSchema = z.object({
  action: z.enum(["play", "stop", "link"]).default("play"),
  userId: z.string().trim().min(1).max(64),
  audioUrl: z.string().url().max(2048).optional(),
  fileId: z.string().trim().min(1).optional(),
  title: z.string().trim().max(120).optional(),
  volume: z.number().min(0).max(1).optional(),
});

/**
 * POST /api/admin/remote-play
 * action=play|stop|link — all admin-only, Socket service stays behind the scenes.
 */
export const POST = withApiHandler(async (req: Request) => {
  await requireAdmin();

  if (!getRemoteAudioAdminToken()) {
    throw new ApiError("未配置 REMOTE_AUDIO_TOKEN", 503);
  }

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    throw new ApiError(parsed.error.issues[0]?.message || "参数无效", 400);
  }

  const { action, userId } = parsed.data;

  if (action === "link") {
    if (!getRemoteAudioReceiverToken()) {
      throw new ApiError("未配置接收端 Token", 503);
    }
    return jsonOk({
      userId,
      receiverUrl: buildReceiverUrl(userId),
      shortcutHint: "快捷指令 → 打开 URL → 粘贴 receiverUrl",
    });
  }

  if (action === "stop") {
    const res = await remoteAudioFetch("/api/stop", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || "停止失败", res.status);
    return jsonOk(data);
  }

  // play
  let audioUrl = parsed.data.audioUrl;
  let title = parsed.data.title;

  if (!audioUrl) {
    if (!parsed.data.fileId) {
      throw new ApiError("请选择音频文件，或填写音频 URL", 400);
    }
    await connectDB();
    const file = await FileModel.findById(parsed.data.fileId).lean();
    if (!file) throw new ApiError("文件不存在", 404);
    if (file.category !== "audio" && !String(file.mimeType || "").startsWith("audio/")) {
      throw new ApiError("请选择音频文件", 400);
    }
    let shareToken = file.shareToken as string | undefined;
    if (!shareToken) {
      shareToken = generateShareToken();
      await FileModel.updateOne({ _id: file._id }, { $set: { shareToken } });
    }
    audioUrl = `${getAppUrl().replace(/\/$/, "")}/l/${shareToken}`;
    title = title || String(file.name || "MediaVault Audio");
  }

  const res = await remoteAudioFetch("/api/play", {
    method: "POST",
    body: JSON.stringify({
      userId,
      audioUrl,
      title,
      volume: parsed.data.volume,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "远程播放服务失败", res.status);

  return jsonOk({ ...data, audioUrl, title });
});
