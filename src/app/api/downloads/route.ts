export const dynamic = 'force-dynamic';

import { z } from "zod";
import { connectDB } from "@/lib/db";
import { DownloadLog } from "@/models/DownloadLog";
import {
  jsonError,
  jsonOk,
  requireAdmin,
  requireAuth,
  withApiHandler,
} from "@/lib/api";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  userId: z.string().optional(),
  export: z.enum(["csv", "json"]).optional(),
  scope: z.enum(["me", "all"]).optional().default("me"),
});

/**
 * GET /api/downloads
 * - scope=me: current user's download history
 * - scope=all: admin-only full audit log (+ optional CSV export)
 */
export const GET = withApiHandler(async (req: Request) => {
  const user = await requireAuth();
  await connectDB();

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    page: url.searchParams.get("page") || undefined,
    limit: url.searchParams.get("limit") || undefined,
    userId: url.searchParams.get("userId") || undefined,
    export: url.searchParams.get("export") || undefined,
    scope: url.searchParams.get("scope") || undefined,
  });

  if (!parsed.success) {
    return jsonError("查询参数无效", 400);
  }

  const { page, limit, export: exportFmt, scope } = parsed.data;
  const filter: Record<string, unknown> = {};

  if (scope === "all") {
    await requireAdmin();
    if (parsed.data.userId) {
      filter.userId = parsed.data.userId;
    }
  } else {
    filter.userId = user.id;
  }

  if (exportFmt === "csv") {
    await requireAdmin();
    const rows = await DownloadLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(5000)
      .populate("userId", "name email")
      .populate("fileId", "name originalName")
      .lean();

    const header = "id,userEmail,userName,fileName,action,ip,createdAt\n";
    const body = rows
      .map((r) => {
        const u = r.userId as unknown as { email?: string; name?: string } | null;
        const f = r.fileId as unknown as { name?: string; originalName?: string } | null;
        return [
          r._id,
          u?.email || "",
          u?.name || "",
          f?.name || f?.originalName || "",
          r.action,
          r.ipAddress || "",
          (r as { createdAt?: Date | string }).createdAt
            ? new Date((r as { createdAt: Date | string }).createdAt).toISOString()
            : "",
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(",");
      })
      .join("\n");

    return new Response(header + body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mediavault-downloads.csv"`,
      },
    });
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    DownloadLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name email")
      .populate("fileId", "name originalName category mimeType size")
      .lean(),
    DownloadLog.countDocuments(filter),
  ]);

  return jsonOk({
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  });
});
