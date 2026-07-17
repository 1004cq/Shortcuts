export const dynamic = "force-dynamic";

import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import {
  ApiError,
  jsonOk,
  requireAuth,
  withApiHandler,
} from "@/lib/api";
import {
  displayNameSchema,
  normalizePhone,
  normalizeUsername,
  phoneSchema,
  usernameSchema,
} from "@/lib/user-profile";

function serializeUser(doc: {
  _id: { toString(): string };
  email: string;
  name: string;
  username?: string | null;
  phone?: string | null;
  role: string;
  membership: string;
  membershipExpiresAt?: Date | null;
  emailVerified?: boolean;
  image?: string | null;
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
    membership: doc.membership,
    membershipExpiresAt: doc.membershipExpiresAt
      ? new Date(doc.membershipExpiresAt).toISOString()
      : null,
    emailVerified: Boolean(doc.emailVerified),
    image: doc.image ?? null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

export const GET = withApiHandler(async () => {
  const sessionUser = await requireAuth();
  await connectDB();
  const user = await User.findById(sessionUser.id).lean();
  if (!user) {
    throw new ApiError("用户不存在", 404);
  }
  return jsonOk({ item: serializeUser(user) });
});

const patchSchema = z
  .object({
    name: displayNameSchema.optional(),
    username: usernameSchema.optional(),
    phone: phoneSchema.optional().nullable(),
  })
  .refine((v) => v.name !== undefined || v.username !== undefined || v.phone !== undefined, {
    message: "至少提供一个要修改的字段",
  });

export const PATCH = withApiHandler(async (req: Request) => {
  const sessionUser = await requireAuth();
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || "参数无效";
    throw new ApiError(msg, 400);
  }

  await connectDB();
  const user = await User.findById(sessionUser.id);
  if (!user) {
    throw new ApiError("用户不存在", 404);
  }

  if (parsed.data.name !== undefined) {
    user.name = parsed.data.name;
  }

  if (parsed.data.username !== undefined) {
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
      throw new ApiError("用户名或手机号已被占用", 409);
    }
    throw err;
  }

  return jsonOk({ item: serializeUser(user) });
});
