export const dynamic = 'force-dynamic';

import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { jsonError, jsonOk, withApiHandler } from "@/lib/api";

const verifySchema = z.object({
  token: z.string().min(10).max(128),
});

export const POST = withApiHandler(async (req: Request) => {
  const body = await req.json();
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("无效的验证令牌", 400);
  }

  await connectDB();

  const user = await User.findOne({
    emailVerificationToken: parsed.data.token,
  }).select("+emailVerificationToken +emailVerificationExpires");

  if (!user) {
    return jsonError("验证链接无效或已使用", 400);
  }

  if (
    user.emailVerificationExpires &&
    new Date(user.emailVerificationExpires).getTime() < Date.now()
  ) {
    return jsonError("验证链接已过期，请重新注册或联系管理员", 400);
  }

  user.emailVerified = true;
  user.emailVerificationToken = null;
  user.emailVerificationExpires = null;
  await user.save();

  return jsonOk({ message: "邮箱验证成功，请登录" });
});
