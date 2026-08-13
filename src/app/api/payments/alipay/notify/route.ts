export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import {
  isAlipayConfigured,
  isPaidTradeStatus,
  parseFormBody,
  verifyAlipayNotify,
} from "@/lib/alipay";
import {
  addAlipayNotifyId,
  fulfillPaidSubscription,
  hasAlipayNotifyId,
} from "@/lib/membership";
import {
  addPlayOrderNotifyId,
  fulfillPlayOrder,
  hasPlayOrderNotifyId,
} from "@/lib/play-recharge";

/**
 * POST /api/payments/alipay/notify
 * Supports both membership Subscription and PlayOrder (times recharge).
 */
export async function POST(req: Request) {
  let outTradeNo = "";
  try {
    if (!isAlipayConfigured()) {
      console.error(JSON.stringify({ tag: "alipay/notify", message: "not configured" }));
      return new Response("fail", { status: 503 });
    }

    const raw = await req.text();
    const payload = parseFormBody(raw);
    outTradeNo = payload.out_trade_no || "";
    const notifyId = payload.notify_id || "";

    if (!payload.sign) {
      return new Response("fail", { status: 400 });
    }

    if (!verifyAlipayNotify(payload)) {
      return new Response("fail", { status: 400 });
    }

    const appId = process.env.ALIPAY_APP_ID?.trim();
    if (appId && payload.app_id && payload.app_id !== appId) {
      return new Response("fail", { status: 400 });
    }

    const replay =
      (outTradeNo &&
        notifyId &&
        ((await hasAlipayNotifyId(outTradeNo, notifyId)) ||
          (await hasPlayOrderNotifyId(outTradeNo, notifyId)))) ||
      false;
    if (replay) {
      return new Response("success");
    }

    if (!isPaidTradeStatus(payload.trade_status)) {
      await addAlipayNotifyId(outTradeNo, notifyId);
      await addPlayOrderNotifyId(outTradeNo, notifyId);
      return new Response("success");
    }

    if (!outTradeNo) {
      return new Response("fail", { status: 400 });
    }

    const paidAt = payload.gmt_payment ? new Date(payload.gmt_payment) : new Date();
    const fulfillArgs = {
      outTradeNo,
      tradeNo: payload.trade_no,
      totalAmount: payload.total_amount,
      paidAt,
    };

    const playResult = await fulfillPlayOrder(fulfillArgs);
    if (playResult.ok) {
      await addAlipayNotifyId(outTradeNo, notifyId);
      await addPlayOrderNotifyId(outTradeNo, notifyId);
      return new Response("success");
    }
    if (playResult.reason === "amount_mismatch") {
      return new Response("fail", { status: 400 });
    }

    const subResult = await fulfillPaidSubscription(fulfillArgs);
    if (!subResult.ok && subResult.reason === "order_not_found") {
      return new Response("fail", { status: 404 });
    }
    if (!subResult.ok && subResult.reason === "amount_mismatch") {
      return new Response("fail", { status: 400 });
    }
    if (!subResult.ok) {
      return new Response("fail", { status: 500 });
    }

    await addAlipayNotifyId(outTradeNo, notifyId);
    await addPlayOrderNotifyId(outTradeNo, notifyId);
    return new Response("success");
  } catch (err) {
    console.error(
      JSON.stringify({
        tag: "alipay/notify",
        message: "exception",
        outTradeNo,
        err: err instanceof Error ? err.message : String(err),
      })
    );
    return new Response("fail", { status: 500 });
  }
}
