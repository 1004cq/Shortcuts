export const dynamic = 'force-dynamic';

import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { FileModel } from "@/models/File";
import { DownloadLog } from "@/models/DownloadLog";
import { Subscription } from "@/models/Subscription";
import { jsonOk, requireAdmin, withApiHandler } from "@/lib/api";

/** GET /api/admin/stats — dashboard KPIs */
export const GET = withApiHandler(async () => {
  await requireAdmin();
  await connectDB();

  const [
    users,
    vipUsers,
    files,
    downloads,
    activeSubs,
    recentDownloads,
    storageAgg,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: { $in: ["vip", "admin"] } }),
    FileModel.countDocuments(),
    DownloadLog.countDocuments({ action: "download" }),
    Subscription.countDocuments({ status: "active" }),
    DownloadLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("userId", "name email")
      .populate("fileId", "name")
      .lean(),
    FileModel.aggregate([{ $group: { _id: null, totalSize: { $sum: "$size" } } }]),
  ]);

  return jsonOk({
    stats: {
      users,
      vipUsers,
      files,
      downloads,
      activeSubs,
      totalStorageBytes: storageAgg[0]?.totalSize || 0,
    },
    recentDownloads,
  });
});
