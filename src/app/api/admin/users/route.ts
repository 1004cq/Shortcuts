export const dynamic = 'force-dynamic';

import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import {
  ApiError,
  jsonOk,
  requireAdmin,
  withApiHandler,
} from "@/lib/api";

export const GET = withApiHandler(async (req: Request) => {
  await requireAdmin();
  await connectDB();

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 20)));
  const q = (url.searchParams.get("q") || "").trim();

  const filter: Record<string, unknown> = {};
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { email: { $regex: escaped, $options: "i" } },
      { name: { $regex: escaped, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return jsonOk({
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  });
});

const patchSchema = z.object({
  userId: z.string(),
  role: z.enum(["user", "vip", "admin"]).optional(),
  membership: z.enum(["free", "monthly", "yearly"]).optional(),
  membershipExpiresAt: z.string().datetime().nullable().optional(),
  emailVerified: z.boolean().optional(),
});

export const PATCH = withApiHandler(async (req: Request) => {
  const admin = await requireAdmin();
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError("参数无效", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(parsed.data.userId)) {
    throw new ApiError("无效用户 ID", 400);
  }

  if (parsed.data.userId === admin.id && parsed.data.role && parsed.data.role !== "admin") {
    throw new ApiError("不能降级自己的管理员权限", 400);
  }

  await connectDB();
  const user = await User.findById(parsed.data.userId);
  if (!user) {
    throw new ApiError("用户不存在", 404);
  }

  if (parsed.data.role) user.role = parsed.data.role;
  if (parsed.data.membership) user.membership = parsed.data.membership;
  if (parsed.data.membershipExpiresAt !== undefined) {
    user.membershipExpiresAt = parsed.data.membershipExpiresAt
      ? new Date(parsed.data.membershipExpiresAt)
      : null;
  }
  if (parsed.data.emailVerified !== undefined) {
    user.emailVerified = parsed.data.emailVerified;
  }

  await user.save();
  return jsonOk({ item: user });
});
