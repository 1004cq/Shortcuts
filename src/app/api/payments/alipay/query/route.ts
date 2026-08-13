export const dynamic = "force-dynamic";

import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Subscription } from "@/models/Subscription";
import { PlayOrder } from "@/models/PlayOrder";
import { User } from "@/models/User";
import { ShortlinkUser } from "@/models/ShortlinkUser";
import { ApiError, jsonOk, requireAuth, withApiHandler } from "@/lib/api";
import { isAlipayConfigured, queryAlipayTrade } from "@/lib/alipay";
import { fulfillPaidSubscription } from "@/lib/membership";
import { fulfillPlayOrder } from "@/lib/play-recharge";

const schema = z.object({
  outTradeNo: z.string().min(6),
});

export const GET = withApiHandler(async (req: Request) => {
  const user = await requireAuth();
  const url = new URL(req.url);
  const parsed = schema.safeParse({ outTradeNo: url.searchParams.get("outTradeNo") || "" });
  if (!parsed.success) {
    throw new ApiError("缺少订单号", 400);
  }

  await connectDB();
  const outTradeNo = parsed.data.outTradeNo;

  const playOrder = await PlayOrder.findOne({
    providerPaymentId: outTradeNo,
    userId: user.id,
  });

  if (playOrder) {
    if (playOrder.status !== "paid" && isAlipayConfigured() && playOrder.provider === "alipay") {
      try {
        const q = await queryAlipayTrade(outTradeNo);
        const tradeStatus = String(q.tradeStatus || q.trade_status || "");
        if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
          await fulfillPlayOrder({
            outTradeNo,
            tradeNo: String(q.tradeNo || q.trade_no || ""),
            totalAmount: q.totalAmount || q.total_amount,
          });
        }
      } catch (err) {
        console.error("[alipay/query] play", err);
      }
    }

    const fresh = await PlayOrder.findById(playOrder._id);
    const shortlink = await ShortlinkUser.findOne({ linkedUserId: user.id }).lean();

    return jsonOk({
      kind: "play",
      order: {
        outTradeNo: fresh?.providerPaymentId,
        times: fresh?.times,
        status: fresh?.status === "paid" ? "active" : fresh?.status,
        amount: fresh?.amount,
        tradeNo: fresh?.providerTradeNo,
      },
      balance: shortlink
        ? {
            remainingTimes: shortlink.remainingTimes,
            usedTimes: shortlink.usedTimes,
          }
        : null,
    });
  }

  const sub = await Subscription.findOne({
    providerPaymentId: outTradeNo,
    userId: user.id,
  });
  if (!sub) {
    throw new ApiError("订单不存在", 404);
  }

  if (sub.status !== "active" && isAlipayConfigured() && sub.provider === "alipay") {
    try {
      const q = await queryAlipayTrade(outTradeNo);
      const tradeStatus = String(q.tradeStatus || q.trade_status || "");
      if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
        await fulfillPaidSubscription({
          outTradeNo,
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
    kind: "membership",
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
