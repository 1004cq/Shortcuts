export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { parseFormBody, verifyAlipayNotify } from "@/lib/alipay";
import { fulfillPaidSubscription } from "@/lib/membership";

/**
 * POST /api/payments/alipay/notify
 * Alipay async notification — must return plain text "success".
 */
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const payload = parseFormBody(raw);

    if (!payload.sign) {
      return new Response("fail", { status: 400 });
    }

    if (!verifyAlipayNotify(payload)) {
      console.error("[alipay/notify] bad signature", payload.out_trade_no);
      return new Response("fail", { status: 400 });
    }

    const appId = process.env.ALIPAY_APP_ID?.trim();
    if (appId && payload.app_id && payload.app_id !== appId) {
      console.error("[alipay/notify] app_id mismatch");
      return new Response("fail", { status: 400 });
    }

    const tradeStatus = payload.trade_status;
    if (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED") {
      // Waiting for buyer / closed — acknowledge without fulfilling
      return new Response("success");
    }

    const outTradeNo = payload.out_trade_no;
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
      console.error("[alipay/notify] order not found", outTradeNo);
      return new Response("fail", { status: 404 });
    }
    if (!result.ok && result.reason === "amount_mismatch") {
      console.error("[alipay/notify] amount mismatch", outTradeNo, payload.total_amount);
      return new Response("fail", { status: 400 });
    }

    return new Response("success");
  } catch (err) {
    console.error("[alipay/notify]", err);
    return new Response("fail", { status: 500 });
  }
}
