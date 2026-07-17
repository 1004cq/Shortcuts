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

/**
 * POST /api/payments/alipay/notify
 * Async notify: verify sign → update order → plain text "success"
 * Anti-replay via notify_id; idempotent when already paid.
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
      console.error(JSON.stringify({ tag: "alipay/notify", message: "missing sign", outTradeNo }));
      return new Response("fail", { status: 400 });
    }

    if (!verifyAlipayNotify(payload)) {
      console.error(
        JSON.stringify({ tag: "alipay/notify", message: "bad signature", outTradeNo, notifyId })
      );
      return new Response("fail", { status: 400 });
    }

    const appId = process.env.ALIPAY_APP_ID?.trim();
    if (appId && payload.app_id && payload.app_id !== appId) {
      console.error(JSON.stringify({ tag: "alipay/notify", message: "app_id mismatch" }));
      return new Response("fail", { status: 400 });
    }

    if (outTradeNo && notifyId && (await hasAlipayNotifyId(outTradeNo, notifyId))) {
      console.log(
        JSON.stringify({ tag: "alipay/notify", message: "replay ignored", outTradeNo, notifyId })
      );
      return new Response("success");
    }

    if (!isPaidTradeStatus(payload.trade_status)) {
      console.log(
        JSON.stringify({
          tag: "alipay/notify",
          message: "non-final",
          outTradeNo,
          tradeStatus: payload.trade_status,
        })
      );
      await addAlipayNotifyId(outTradeNo, notifyId);
      return new Response("success");
    }

    if (!outTradeNo) {
      return new Response("fail", { status: 400 });
    }

    const result = await fulfillPaidSubscription({
      outTradeNo,
      tradeNo: payload.trade_no,
      totalAmount: payload.total_amount,
      paidAt: payload.gmt_payment ? new Date(payload.gmt_payment) : new Date(),
    });

    if (!result.ok && result.reason === "order_not_found") {
      console.error(JSON.stringify({ tag: "alipay/notify", message: "order_not_found", outTradeNo }));
      return new Response("fail", { status: 404 });
    }
    if (!result.ok && result.reason === "amount_mismatch") {
      console.error(
        JSON.stringify({
          tag: "alipay/notify",
          message: "amount_mismatch",
          outTradeNo,
          total_amount: payload.total_amount,
        })
      );
      return new Response("fail", { status: 400 });
    }

    await addAlipayNotifyId(outTradeNo, notifyId);

    console.log(
      JSON.stringify({
        tag: "alipay/notify",
        message: result.already ? "already_active" : "fulfilled",
        outTradeNo,
        tradeNo: payload.trade_no,
      })
    );

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
