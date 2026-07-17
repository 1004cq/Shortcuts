"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle2, Loader2, XCircle, Clock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function ResultInner() {
  const searchParams = useSearchParams();
  const { update } = useSession();
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
  const [expiresAt, setExpiresAt] = React.useState<string | null>(null);

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

        if (data.order?.status === "active") {
          setStatus("success");
          setExpiresAt(data.membership?.expiresAt || null);
          setMessage("支付成功，会员已开通");
          await update({
            role: data.membership?.role,
            membership: data.membership?.plan,
            membershipExpiresAt: data.membership?.expiresAt,
          });
          return;
        }

        if (attempts >= 8) {
          setStatus("pending");
          setMessage("支付结果确认中，请稍后在个人中心查看会员状态。若已扣款未到账，请联系管理员。");
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

    if (status === "loading" || status === "success") {
      // Always confirm once via API (idempotent)
      void poll();
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outTradeNo]);

  return (
    <AppShell showUpload={false} showSearch={false} title="支付结果">
      <div className="mx-auto flex max-w-md justify-center py-8 animate-slide-up">
        <Card className="w-full rounded-2xl">
          <CardHeader className="items-center text-center">
            {status === "loading" && <Loader2 className="h-12 w-12 animate-spin text-primary" />}
            {status === "success" && <CheckCircle2 className="h-12 w-12 text-success" />}
            {status === "pending" && <Clock className="h-12 w-12 text-primary" />}
            {status === "error" && <XCircle className="h-12 w-12 text-destructive" />}
            <CardTitle className="font-display text-xl">
              {status === "loading" && "正在确认支付…"}
              {status === "success" && "开通成功"}
              {status === "pending" && "等待确认"}
              {status === "error" && "支付异常"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
            <p>{message || (status === "loading" ? "请稍候，正在向支付宝核对订单" : "")}</p>
            {outTradeNo && (
              <p className="break-all font-mono text-[11px] text-muted-foreground/80">
                订单号：{outTradeNo}
              </p>
            )}
            {expiresAt && (
              <p className="text-foreground">
                会员到期：{new Date(expiresAt).toLocaleString()}
              </p>
            )}
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
              <Button asChild>
                <Link href="/">返回文件库</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/profile">个人中心</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default function PricingResultPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <ResultInner />
    </React.Suspense>
  );
}
