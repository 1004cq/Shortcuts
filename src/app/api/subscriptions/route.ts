export const dynamic = 'force-dynamic';

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

const checkoutSchema = z.object({
  plan: z.enum(["monthly", "yearly"]),
});

/**
 * POST /api/subscriptions
 * Demo checkout: activates VIP immediately (manual provider).
 * Replace with Stripe / 易支付 webhook flow in production.
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

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  if (parsed.data.plan === "monthly") {
    endsAt.setMonth(endsAt.getMonth() + 1);
  } else {
    endsAt.setFullYear(endsAt.getFullYear() + 1);
  }

  const sub = await Subscription.create({
    userId: sessionUser.id,
    plan: parsed.data.plan,
    status: "active",
    amount: planMeta.price,
    currency: planMeta.currency,
    startsAt,
    endsAt,
    provider: "manual",
  });

  // Admins keep admin role; others become vip
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
    subscription: sub,
    membership: {
      plan: user.membership,
      role: user.role,
      expiresAt: endsAt.toISOString(),
    },
    message: "会员已激活（演示模式：无需真实支付）",
  });
});

export const GET = withApiHandler(async () => {
  const user = await requireAuth();
  await connectDB();

  const items = await Subscription.find({ userId: user.id })
    .sort({ createdAt: -1 })
    .lean();

  return jsonOk({ items, plans: PRICING_PLANS });
});
