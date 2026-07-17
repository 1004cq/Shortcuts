export const dynamic = "force-dynamic";

import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Subscription } from "@/models/Subscription";
import { User } from "@/models/User";
import { ApiError, jsonOk, requireAuth, withApiHandler } from "@/lib/api";
import { isAlipayConfigured, queryAlipayTrade } from "@/lib/alipay";
import { fulfillPaidSubscription } from "@/lib/membership";

const schema = z.object({
  outTradeNo: z.string().min(6),
});

/**
 * GET /api/payments/alipay/query?outTradeNo=
 * Poll order status after returning from Alipay; may fulfill via trade.query.
 */
export const GET = withApiHandler(async (req: Request) => {
  const user = await requireAuth();
  const url = new URL(req.url);
  const parsed = schema.safeParse({ outTradeNo: url.searchParams.get("outTradeNo") || "" });
  if (!parsed.success) {
    throw new ApiError("缺少订单号", 400);
  }

  await connectDB();
  const sub = await Subscription.findOne({
    providerPaymentId: parsed.data.outTradeNo,
    userId: user.id,
  });
  if (!sub) {
    throw new ApiError("订单不存在", 404);
  }

  if (sub.status !== "active" && isAlipayConfigured() && sub.provider === "alipay") {
    try {
      const q = await queryAlipayTrade(parsed.data.outTradeNo);
      const tradeStatus = String(q.tradeStatus || q.trade_status || "");
      if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
        await fulfillPaidSubscription({
          outTradeNo: parsed.data.outTradeNo,
          tradeNo: String(q.tradeNo || q.trade_no || ""),
          totalAmount: q.totalAmount || q.total_amount,
        });
      }
    } catch (err) {
      console.error("[alipay/query]", err);
    }
  }

  const fresh = await Subscription.findById(sub._id);
  const dbUser = await User.findById(user.id);

  return jsonOk({
    order: {
      outTradeNo: fresh?.providerPaymentId,
      plan: fresh?.plan,
      status: fresh?.status,
      amount: fresh?.amount,
      startsAt: fresh?.startsAt,
      endsAt: fresh?.endsAt,
      tradeNo: fresh?.providerTradeNo,
    },
    membership: dbUser
      ? {
          plan: dbUser.membership,
          role: dbUser.role,
          expiresAt: dbUser.membershipExpiresAt?.toISOString?.() || dbUser.membershipExpiresAt,
        }
      : null,
  });
});
