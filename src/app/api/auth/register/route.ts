export const dynamic = 'force-dynamic';

import bcrypt from "bcryptjs";
import { z } from "zod";
import { nanoid } from "nanoid";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { sendVerificationEmail } from "@/lib/email";
import { jsonError, jsonOk, withApiHandler } from "@/lib/api";

const registerSchema = z.object({
  name: z.string().trim().min(1, "请填写昵称").max(80),
  email: z.string().email("请填写有效邮箱").max(254),
  password: z
    .string()
    .min(8, "密码至少 8 位")
    .max(128)
    .regex(/[A-Za-z]/, "密码需包含字母")
    .regex(/[0-9]/, "密码需包含数字"),
});

export const POST = withApiHandler(async (req: Request) => {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message || "参数无效", 400);
  }

  const { name, email, password } = parsed.data;
  await connectDB();

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return jsonError("该邮箱已被注册", 409);
  }

  const hash = await bcrypt.hash(password, 12);
  const token = nanoid(32);

  await User.create({
    name,
    email: email.toLowerCase(),
    password: hash,
    role: "user",
    membership: "free",
    emailVerified: false,
    emailVerificationToken: token,
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const mail = await sendVerificationEmail(email.toLowerCase(), token);

  return jsonOk({
    message: "注册成功，请查收验证邮件",
    // Expose verify URL only in development when SMTP is not configured
    ...(mail.dev ? { verifyUrl: mail.verifyUrl } : {}),
  });
});
