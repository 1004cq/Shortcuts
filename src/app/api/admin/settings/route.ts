export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
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

function serializeAdmin(doc: {
  _id: { toString(): string };
  email: string;
  name: string;
  username?: string | null;
  phone?: string | null;
  role: string;
  emailVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    username: doc.username ?? null,
    phone: doc.phone ?? null,
    role: doc.role,
    emailVerified: Boolean(doc.emailVerified),
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

export const GET = withApiHandler(async () => {
  const admin = await requireAdmin();
  await connectDB();
  const user = await User.findById(admin.id).lean();
  if (!user || user.role !== "admin") {
    throw new ApiError("管理员账号不存在", 404);
  }
  return jsonOk({ item: serializeAdmin(user) });
});

const patchSchema = z
  .object({
    name: displayNameSchema.optional(),
    email: z.string().email("请填写有效邮箱").max(254).optional(),
    username: usernameSchema.optional().nullable(),
    phone: phoneSchema.optional().nullable(),
    currentPassword: z.string().min(1).max(128).optional(),
    password: passwordSchema.optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.email !== undefined ||
      v.username !== undefined ||
      v.phone !== undefined ||
      v.password !== undefined,
    { message: "至少提供一个要修改的字段" }
  )
  .refine((v) => !v.password || Boolean(v.currentPassword), {
    message: "修改密码需填写当前密码",
    path: ["currentPassword"],
  });

export const PATCH = withApiHandler(async (req: Request) => {
  const admin = await requireAdmin();
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || "参数无效";
    throw new ApiError(msg, 400);
  }

  await connectDB();
  const user = await User.findById(admin.id).select("+password");
  if (!user || user.role !== "admin") {
    throw new ApiError("管理员账号不存在", 404);
  }

  if (parsed.data.password) {
    if (!user.password || !parsed.data.currentPassword) {
      throw new ApiError("修改密码需填写当前密码", 400);
    }
    const ok = await bcrypt.compare(parsed.data.currentPassword, user.password);
    if (!ok) {
      throw new ApiError("当前密码不正确", 400);
    }
    user.password = await bcrypt.hash(parsed.data.password, 12);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
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

  try {
    await user.save();
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 11000) {
      throw new ApiError("邮箱、用户名或手机号已被占用", 409);
    }
    throw err;
  }

  return jsonOk({
    item: serializeAdmin(user),
    message: parsed.data.password ? "管理员账号与密码已更新" : "管理员账号已更新",
  });
});
