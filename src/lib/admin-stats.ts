import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { FileModel } from "@/models/File";
import { DownloadLog } from "@/models/DownloadLog";
import { Subscription } from "@/models/Subscription";

export type AdminStatsPayload = {
  stats: {
    users: number;
    vipUsers: number;
    files: number;
    downloads: number;
    streams: number;
    activeSubs: number;
    totalStorageBytes: number;
  };
  series: {
    activityByDay: Array<{ date: string; downloads: number; streams: number; previews: number }>;
    actions: Array<{ name: string; value: number; fill: string }>;
    roles: Array<{ name: string; value: number; fill: string }>;
    categories: Array<{ name: string; value: number }>;
  };
  recentDownloads: Array<Record<string, unknown>>;
  updatedAt: string;
};

const ACTION_COLORS: Record<string, string> = {
  download: "#38bdf8",
  stream: "#a78bfa",
  preview: "#34d399",
};

const ROLE_COLORS: Record<string, string> = {
  user: "#64748b",
  vip: "#fbbf24",
  admin: "#60a5fa",
};

const CATEGORY_LABELS: Record<string, string> = {
  video: "视频",
  audio: "音频",
  document: "文档",
  image: "图片",
  other: "其他",
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function collectAdminStats(): Promise<AdminStatsPayload> {
  await connectDB();

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 13);
  since.setUTCHours(0, 0, 0, 0);

  const [
    users,
    vipUsers,
    files,
    downloads,
    streams,
    activeSubs,
    recentDownloads,
    storageAgg,
    roleAgg,
    categoryAgg,
    activityLogs,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: { $in: ["vip", "admin"] } }),
    FileModel.countDocuments(),
    DownloadLog.countDocuments({ action: "download" }),
    DownloadLog.countDocuments({ action: "stream" }),
    Subscription.countDocuments({ status: "active" }),
    DownloadLog.find()
      .sort({ createdAt: -1 })
      .limit(12)
      .populate("userId", "name email username")
      .populate("fileId", "name category")
      .lean(),
    FileModel.aggregate([{ $group: { _id: null, totalSize: { $sum: "$size" } } }]),
    User.aggregate([{ $group: { _id: "$role", value: { $sum: 1 } } }]),
    FileModel.aggregate([{ $group: { _id: "$category", value: { $sum: 1 } } }]),
    DownloadLog.find({ createdAt: { $gte: since } })
      .select("action createdAt")
      .lean(),
  ]);

  const dayMap = new Map<
    string,
    { date: string; downloads: number; streams: number; previews: number }
  >();
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const key = dayKey(d);
    dayMap.set(key, { date: key.slice(5), downloads: 0, streams: 0, previews: 0 });
  }

  const actionCounts = { download: 0, stream: 0, preview: 0 };
  for (const log of activityLogs) {
    const key = dayKey(new Date(log.createdAt as Date));
    const bucket = dayMap.get(key);
    const action = String(log.action) as keyof typeof actionCounts;
    if (bucket && action in actionCounts) {
      if (action === "download") bucket.downloads += 1;
      if (action === "stream") bucket.streams += 1;
      if (action === "preview") bucket.previews += 1;
      actionCounts[action] += 1;
    }
  }

  return {
    stats: {
      users,
      vipUsers,
      files,
      downloads,
      streams,
      activeSubs,
      totalStorageBytes: storageAgg[0]?.totalSize || 0,
    },
    series: {
      activityByDay: Array.from(dayMap.values()),
      actions: (["download", "stream", "preview"] as const).map((name) => ({
        name: name === "download" ? "下载" : name === "stream" ? "播放" : "预览",
        value: actionCounts[name],
        fill: ACTION_COLORS[name],
      })),
      roles: roleAgg.map((r) => ({
        name: r._id === "admin" ? "管理员" : r._id === "vip" ? "VIP" : "普通",
        value: r.value as number,
        fill: ROLE_COLORS[String(r._id)] || "#94a3b8",
      })),
      categories: categoryAgg.map((c) => ({
        name: CATEGORY_LABELS[String(c._id)] || String(c._id),
        value: c.value as number,
      })),
    },
    recentDownloads: recentDownloads as Array<Record<string, unknown>>,
    updatedAt: new Date().toISOString(),
  };
}
