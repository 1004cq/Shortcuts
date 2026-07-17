export const dynamic = "force-dynamic";

import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Subscription } from "@/models/Subscription";
import { PRICING_PLANS } from "@/types";
import {
  ApiError,
  jsonOk,
  requireAuth,
  withApiHandler,
} from "@/lib/api";
import {
  createAlipayPayUrl,
  isAlipayConfigured,
  isDemoCheckoutAllowed,
  isMobileUserAgent,
} from "@/lib/alipay";
import { calcMembershipWindow, generateOutTradeNo } from "@/lib/membership";

const checkoutSchema = z.object({
  plan: z.enum(["monthly", "yearly"]),
});

/**
 * POST /api/subscriptions
 * Create an Alipay checkout (or demo activate when Alipay is not configured).
 */
export const POST = withApiHandler(async (req: Request) => {
  const sessionUser = await requireAuth();
  const body = await req.json();
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError("请选择有效套餐", 400);
  }

  const planMeta = PRICING_PLANS.find((p) => p.id === parsed.data.plan);
  if (!planMeta || planMeta.id === "free") {
    throw new ApiError("无效套餐", 400);
  }

  await connectDB();

  // —— Real Alipay checkout ——
  if (isAlipayConfigured()) {
    const outTradeNo = generateOutTradeNo();
    const subject =
      planMeta.id === "monthly" ? "MediaVault 月度会员" : "MediaVault 年度会员";

    await Subscription.create({
      userId: sessionUser.id,
      plan: parsed.data.plan,
      status: "pending",
      amount: planMeta.price,
      currency: planMeta.currency,
      provider: "alipay",
      providerPaymentId: outTradeNo,
    });

    const ua = req.headers.get("user-agent");
    const payUrl = createAlipayPayUrl({
      outTradeNo,
      subject,
      totalAmount: planMeta.price,
      body: `${subject} · ${sessionUser.email}`,
      mobile: isMobileUserAgent(ua),
    });

    return jsonOk({
      mode: "alipay",
      outTradeNo,
      payUrl,
      amount: planMeta.price,
      plan: parsed.data.plan,
      message: "正在跳转支付宝收银台…",
    });
  }

  // —— Demo fallback (local / not configured) ——
  if (!isDemoCheckoutAllowed()) {
    throw new ApiError("支付宝未配置，且演示支付已关闭", 503);
  }

  const { startsAt, endsAt } = calcMembershipWindow(parsed.data.plan);
  const outTradeNo = generateOutTradeNo();

  const sub = await Subscription.create({
    userId: sessionUser.id,
    plan: parsed.data.plan,
    status: "active",
    amount: planMeta.price,
    currency: planMeta.currency,
    startsAt,
    endsAt,
    provider: "manual",
    providerPaymentId: outTradeNo,
  });

  const user = await User.findById(sessionUser.id);
  if (!user) {
    throw new ApiError("用户不存在", 404);
  }

  if (user.role !== "admin") {
    user.role = "vip";
  }
  user.membership = parsed.data.plan;
  user.membershipExpiresAt = endsAt;
  await user.save();

  return jsonOk({
    mode: "demo",
    subscription: sub,
    membership: {
      plan: user.membership,
      role: user.role,
      expiresAt: endsAt.toISOString(),
    },
    message: "会员已激活（演示模式：未配置支付宝密钥）",
  });
});

export const GET = withApiHandler(async () => {
  const user = await requireAuth();
  await connectDB();

  const items = await Subscription.find({ userId: user.id })
    .sort({ createdAt: -1 })
    .lean();

  return jsonOk({
    items,
    plans: PRICING_PLANS,
    payment: {
      alipay: isAlipayConfigured(),
      demo: isDemoCheckoutAllowed(),
    },
  });
});
