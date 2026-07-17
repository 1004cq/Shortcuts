export const dynamic = "force-dynamic";

import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Subscription } from "@/models/Subscription";
import { User } from "@/models/User";
import { ApiError, jsonOk, requireAdmin, withApiHandler } from "@/lib/api";
import { isAlipayConfigured, refundAlipayTrade } from "@/lib/alipay";
import { generateOutTradeNo } from "@/lib/membership";

const schema = z.object({
  outTradeNo: z.string().min(6),
  refundAmount: z.number().positive().optional(),
  reason: z.string().max(200).optional(),
});

/**
 * POST /api/payments/alipay/refund
 * Admin-only optional refund via alipay.trade.refund
 */
export const POST = withApiHandler(async (req: Request) => {
  await requireAdmin();
  if (!isAlipayConfigured()) {
    throw new ApiError("支付宝未配置", 503);
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError("参数无效", 400);
  }

  await connectDB();
  const sub = await Subscription.findOne({
    providerPaymentId: parsed.data.outTradeNo,
    provider: "alipay",
  });
  if (!sub) {
    throw new ApiError("订单不存在", 404);
  }
  if (sub.status !== "active") {
    throw new ApiError(`订单状态不可退款: ${sub.status}`, 400);
  }

  const refundAmount = parsed.data.refundAmount ?? Number(sub.amount);
  if (refundAmount > Number(sub.amount)) {
    throw new ApiError("退款金额超过订单金额", 400);
  }

  const outRequestNo = generateOutTradeNo("RF");
  const result = await refundAlipayTrade({
    outTradeNo: parsed.data.outTradeNo,
    refundAmount,
    refundReason: parsed.data.reason || "管理员退款",
    outRequestNo,
  });

  const code = String(result.code || "");
  if (code && code !== "10000") {
    throw new ApiError(String(result.subMsg || result.msg || "退款失败"), 400);
  }

  sub.status = "canceled";
  sub.refundAmount = refundAmount;
  sub.refundedAt = new Date();
  await sub.save();

  // Downgrade user if this was their current paid plan window
  const user = await User.findById(sub.userId);
  if (user && user.role !== "admin") {
    const otherActive = await Subscription.exists({
      userId: user._id,
      status: "active",
      _id: { $ne: sub._id },
      endsAt: { $gt: new Date() },
    });
    if (!otherActive) {
      user.role = "user";
      user.membership = "free";
      user.membershipExpiresAt = null;
      await user.save();
    }
  }

  return jsonOk({
    order: {
      outTradeNo: sub.providerPaymentId,
      status: sub.status,
      refundAmount: sub.refundAmount,
      refundedAt: sub.refundedAt,
    },
    result,
  });
});
