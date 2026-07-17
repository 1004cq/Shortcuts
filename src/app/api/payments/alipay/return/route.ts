export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { isAlipayConfigured, queryAlipayTrade, verifyAlipayNotify } from "@/lib/alipay";
import { fulfillPaidSubscription } from "@/lib/membership";

/**
 * GET /api/payments/alipay/return
 * Optional sync return proxy — verifies params, tries to fulfill, redirects to UI.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    params[k] = v;
  });

  const outTradeNo = params.out_trade_no || "";
  const resultUrl = new URL("/pricing/result", process.env.APP_URL || url.origin);
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
          await fulfillPaidSubscription({
            outTradeNo,
            tradeNo: String(q.tradeNo || q.trade_no || params.trade_no || ""),
            totalAmount: q.totalAmount || q.total_amount || params.total_amount,
          });
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
