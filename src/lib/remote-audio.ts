import { getAppUrl } from "@/lib/utils";

export function getRemoteAudioBase(): string {
  return (process.env.REMOTE_AUDIO_URL || `${getAppUrl()}/realtime`).replace(/\/$/, "");
}

export function getRemoteAudioAdminToken(): string {
  return process.env.REMOTE_AUDIO_TOKEN || "";
}

/** Token embedded in iPhone receiver / Shortcuts URLs */
export function getRemoteAudioReceiverToken(): string {
  return process.env.REMOTE_AUDIO_RECEIVER_TOKEN || process.env.REMOTE_AUDIO_TOKEN || "";
}

export function buildReceiverUrl(userId: string): string {
  const base = getRemoteAudioBase();
  const token = getRemoteAudioReceiverToken();
  const q = new URLSearchParams({
    userId,
    token,
    autostart: "1",
  });
  return `${base}/receiver.html?${q.toString()}`;
}

export async function remoteAudioFetch(
  path: string,
  init?: RequestInit & { admin?: boolean }
): Promise<Response> {
  const token = getRemoteAudioAdminToken();
  if (!token) {
    throw new Error("未配置 REMOTE_AUDIO_TOKEN");
  }
  const headers = new Headers(init?.headers);
  headers.set("x-auth-token", token);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${getRemoteAudioBase()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
