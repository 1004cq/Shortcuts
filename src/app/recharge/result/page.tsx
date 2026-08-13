"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function ResultInner() {
  const searchParams = useSearchParams();
  const outTradeNo = searchParams.get("out_trade_no") || "";
  const initialStatus = searchParams.get("status") || "";

  const [status, setStatus] = React.useState<"loading" | "success" | "pending" | "error">(
    initialStatus === "success"
      ? "success"
      : initialStatus === "invalid" || initialStatus === "error"
        ? "error"
        : "loading"
  );
  const [message, setMessage] = React.useState("");
  const [remaining, setRemaining] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!outTradeNo) {
      setStatus("error");
      setMessage("缺少订单号");
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch(
          `/api/payments/alipay/query?outTradeNo=${encodeURIComponent(outTradeNo)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "查询失败");
        if (cancelled) return;

        if (data.order?.status === "active" || data.order?.status === "paid") {
          setStatus("success");
          setRemaining(data.balance?.remainingTimes ?? null);
          setMessage(
            data.kind === "play"
              ? `支付成功，已到账 ${data.order?.times ?? ""} 次`
              : "支付成功"
          );
          return;
        }

        if (attempts >= 8) {
          setStatus("pending");
          setMessage("支付结果确认中，请稍后在「充值」页查看次数。若已扣款未到账，请联系管理员。");
          return;
        }
        setTimeout(poll, 1500);
      } catch (err) {
        if (cancelled) return;
        if (attempts >= 5) {
          setStatus("error");
          setMessage(err instanceof Error ? err.message : "查询失败");
          return;
        }
        setTimeout(poll, 1500);
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [outTradeNo]);

  const icon =
    status === "success" ? (
      <CheckCircle2 className="h-12 w-12 text-emerald-400" />
    ) : status === "error" ? (
      <XCircle className="h-12 w-12 text-red-400" />
    ) : status === "pending" ? (
      <Clock className="h-12 w-12 text-amber-400" />
    ) : (
      <Loader2 className="h-12 w-12 animate-spin text-sky-400" />
    );

  return (
    <Card className="mx-auto max-w-md rounded-2xl">
      <CardHeader className="items-center text-center">
        {icon}
        <CardTitle className="mt-3">
          {status === "success"
            ? "充值成功"
            : status === "error"
              ? "支付异常"
              : status === "pending"
                ? "确认中"
                : "正在确认支付…"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
        <p>{message}</p>
        {remaining != null && (
          <p className="text-foreground">
            当前剩余 <span className="font-semibold text-sky-300">{remaining}</span> 次
          </p>
        )}
        <div className="flex justify-center gap-2">
          <Button asChild>
            <Link href="/recharge">返回充值</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">回首页</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RechargeResultPage() {
  return (
    <AppShell showUpload={false} showSearch={false} title="支付结果">
      <Suspense
        fallback={
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中…
          </div>
        }
      >
        <ResultInner />
      </Suspense>
    </AppShell>
  );
}
