export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { isAlipayConfigured, queryAlipayTrade, verifyAlipayNotify } from "@/lib/alipay";
import { fulfillPaidSubscription } from "@/lib/membership";
import { fulfillPlayOrder } from "@/lib/play-recharge";

/**
 * GET /api/payments/alipay/return
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    params[k] = v;
  });

  const outTradeNo = params.out_trade_no || "";
  const resultUrl = new URL("/recharge/result", process.env.APP_URL || url.origin);
  if (outTradeNo) resultUrl.searchParams.set("out_trade_no", outTradeNo);

  try {
    if (isAlipayConfigured() && params.sign) {
      const ok = verifyAlipayNotify(params);
      if (!ok) {
        resultUrl.searchParams.set("status", "invalid");
        return NextResponse.redirect(resultUrl);
      }
    }

    if (outTradeNo && isAlipayConfigured()) {
      try {
        const q = await queryAlipayTrade(outTradeNo);
        const tradeStatus = String(q.tradeStatus || q.trade_status || "");
        if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
          const args = {
            outTradeNo,
            tradeNo: String(q.tradeNo || q.trade_no || params.trade_no || ""),
            totalAmount: q.totalAmount || q.total_amount || params.total_amount,
          };
          const playResult = await fulfillPlayOrder(args);
          if (!playResult.ok && playResult.reason === "order_not_found") {
            await fulfillPaidSubscription(args);
          }
          resultUrl.searchParams.set("status", "success");
          return NextResponse.redirect(resultUrl);
        }
      } catch (err) {
        console.error("[alipay/return] query failed", err);
      }
    }

    resultUrl.searchParams.set("status", "pending");
    return NextResponse.redirect(resultUrl);
  } catch (err) {
    console.error("[alipay/return]", err);
    resultUrl.searchParams.set("status", "error");
    return NextResponse.redirect(resultUrl);
  }
}
