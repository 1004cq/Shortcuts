export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Subscription } from "@/models/Subscription";
import { DownloadLog } from "@/models/DownloadLog";
import {
  ApiError,
  jsonOk,
  requireAdmin,
  withApiHandler,
} from "@/lib/api";
import {
  displayNameSchema,
  normalizePhone,
  normalizeUsername,
  phoneSchema,
  usernameSchema,
} from "@/lib/user-profile";

const passwordSchema = z
  .string()
  .min(8, "密码至少 8 位")
  .max(128)
  .regex(/[A-Za-z]/, "密码需包含字母")
  .regex(/[0-9]/, "密码需包含数字");

export const GET = withApiHandler(async (req: Request) => {
  await requireAdmin();
  await connectDB();

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 20)));
  const q = (url.searchParams.get("q") || "").trim();

  // Admin accounts are managed only under /admin/settings
  const filter: Record<string, unknown> = { role: { $ne: "admin" } };
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { email: { $regex: escaped, $options: "i" } },
      { name: { $regex: escaped, $options: "i" } },
      { username: { $regex: escaped, $options: "i" } },
      { phone: { $regex: escaped, $options: "i" } },
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
  name: displayNameSchema.optional(),
  email: z.string().email().max(254).optional(),
  username: usernameSchema.optional().nullable(),
  phone: phoneSchema.optional().nullable(),
  role: z.enum(["user", "vip"]).optional(),
  membership: z.enum(["free", "monthly", "yearly"]).optional(),
  membershipExpiresAt: z.string().datetime().nullable().optional(),
  emailVerified: z.boolean().optional(),
  /** Admin-set new password for members; omit or empty to leave unchanged */
  password: passwordSchema.optional(),
});

export const PATCH = withApiHandler(async (req: Request) => {
  await requireAdmin();
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || "参数无效";
    throw new ApiError(msg, 400);
  }

  if (!mongoose.Types.ObjectId.isValid(parsed.data.userId)) {
    throw new ApiError("无效用户 ID", 400);
  }

  await connectDB();
  const user = await User.findById(parsed.data.userId);
  if (!user) {
    throw new ApiError("用户不存在", 404);
  }

  if (user.role === "admin") {
    throw new ApiError("管理员账号请在「系统设置」中修改", 403);
  }

  if (parsed.data.name !== undefined) {
    user.name = parsed.data.name;
  }

  if (parsed.data.email !== undefined) {
    const email = parsed.data.email.toLowerCase().trim();
    const emailTaken = await User.findOne({
      email,
      _id: { $ne: user._id },
    }).lean();
    if (emailTaken) {
      throw new ApiError("该邮箱已被使用", 409);
    }
    user.email = email;
  }

  if (parsed.data.username !== undefined) {
    if (parsed.data.username === null || parsed.data.username === "") {
      user.username = null;
    } else {
      const username = normalizeUsername(parsed.data.username);
      const taken = await User.findOne({
        username,
        _id: { $ne: user._id },
      }).lean();
      if (taken) {
        throw new ApiError("该用户名已被占用", 409);
      }
      user.username = username;
    }
  }

  if (parsed.data.phone !== undefined) {
    if (parsed.data.phone === null || parsed.data.phone === "") {
      user.phone = null;
    } else {
      const phone = normalizePhone(parsed.data.phone);
      const taken = await User.findOne({
        phone,
        _id: { $ne: user._id },
      }).lean();
      if (taken) {
        throw new ApiError("该手机号已被绑定", 409);
      }
      user.phone = phone;
    }
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

  if (parsed.data.password !== undefined) {
    user.password = await bcrypt.hash(parsed.data.password, 12);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
  }

  // Keep role/membership consistent for common admin shortcuts
  if (parsed.data.role === "user" && parsed.data.membership === undefined) {
    user.membership = "free";
    if (parsed.data.membershipExpiresAt === undefined) {
      user.membershipExpiresAt = null;
    }
  }
  if (parsed.data.role === "vip" && user.membership === "free") {
    user.membership = "monthly";
  }

  try {
    await user.save();
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 11000) {
      throw new ApiError("邮箱、用户名或手机号已被占用", 409);
    }
    throw err;
  }

  return jsonOk({ item: user });
});

const deleteSchema = z.object({
  userId: z.string(),
});

export const DELETE = withApiHandler(async (req: Request) => {
  const admin = await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError("缺少 userId", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(parsed.data.userId)) {
    throw new ApiError("无效用户 ID", 400);
  }

  await connectDB();
  const user = await User.findById(parsed.data.userId);
  if (!user) {
    throw new ApiError("用户不存在", 404);
  }

  if (user.role === "admin") {
    throw new ApiError("不能通过用户管理删除管理员账号", 403);
  }

  if (parsed.data.userId === admin.id) {
    throw new ApiError("不能删除当前登录账号", 400);
  }

  const userId = user._id;
  await Promise.all([
    Subscription.deleteMany({ userId }),
    DownloadLog.deleteMany({ userId }),
  ]);
  await User.deleteOne({ _id: userId });

  return jsonOk({
    ok: true,
    deletedUserId: String(userId),
  });
});
