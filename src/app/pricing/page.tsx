"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Check, Crown, Loader2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PRICING_PLANS } from "@/types";
import type { MembershipPlan, SessionUser } from "@/types";
import { cn } from "@/lib/utils";

export default function PricingPage() {
  const { data, update } = useSession();
  const user = data?.user as SessionUser | undefined;
  const [loadingPlan, setLoadingPlan] = React.useState<MembershipPlan | null>(null);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [alipayEnabled, setAlipayEnabled] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/subscriptions");
        const data = await res.json();
        if (res.ok) setAlipayEnabled(Boolean(data.payment?.alipay));
      } catch {
        setAlipayEnabled(null);
      }
    })();
  }, []);

  const checkout = async (plan: MembershipPlan) => {
    if (plan === "free") return;
    setLoadingPlan(plan);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "开通失败");

      if (data.mode === "alipay" && data.payUrl) {
        setMessage("正在跳转支付宝…");
        window.location.href = data.payUrl;
        return;
      }

      await update({
        role: data.membership.role,
        membership: data.membership.plan,
        membershipExpiresAt: data.membership.expiresAt,
      });

      setMessage(data.message || "会员已激活");
    } catch (err) {
      setError(err instanceof Error ? err.message : "开通失败");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <AppShell showUpload={false} title="会员套餐">
      <div className="mx-auto max-w-5xl animate-slide-up">
        <div className="mb-6 text-center sm:mb-10">
          <Badge variant="vip" className="mb-3">
            <Sparkles className="mr-1 h-3 w-3" />
            MediaVault VIP
          </Badge>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            解锁下载与流媒体播放
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            免费用户可浏览文件列表。VIP 支持在线播放、流式传输与无限下载。
            {alipayEnabled
              ? " 支持支付宝安全支付开通。"
              : " 当前为演示模式（未配置支付宝密钥时可直接激活）。"}
          </p>
          {user && (
            <p className="mt-2 text-sm text-muted-foreground">
              当前套餐：<span className="text-foreground">{user.membership}</span>
              {user.membershipExpiresAt
                ? ` · 到期 ${new Date(user.membershipExpiresAt).toLocaleDateString()}`
                : ""}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
          {PRICING_PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                "relative overflow-hidden rounded-2xl transition duration-300 hover:-translate-y-1",
                plan.highlighted &&
                  "order-first border-primary shadow-lg shadow-primary/20 md:order-none"
              )}
            >
              {plan.highlighted && <div className="absolute inset-x-0 top-0 h-1 bg-primary" />}
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-xl">{plan.name}</CardTitle>
                  {plan.highlighted && (
                    <Badge>
                      <Crown className="mr-1 h-3 w-3" />
                      推荐
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  <span className="font-display text-3xl font-bold text-foreground">
                    ¥{plan.price}
                  </span>
                  <span className="text-muted-foreground">
                    /{plan.interval === "month" ? "月" : plan.interval === "year" ? "年" : "永久"}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {plan.id === "free" ? (
                  <Button variant="outline" className="w-full" disabled>
                    当前免费可用
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "secondary"}
                    disabled={loadingPlan !== null}
                    onClick={() => checkout(plan.id)}
                  >
                    {loadingPlan === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Crown className="h-4 w-4" />
                    )}
                    {alipayEnabled
                      ? user?.membership === plan.id
                        ? "支付宝续费"
                        : "支付宝开通"
                      : user?.membership === plan.id
                        ? "续费 / 重新激活"
                        : "立即开通"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {message && <p className="mt-6 text-center text-success">{message}</p>}
        {error && <p className="mt-6 text-center text-destructive">{error}</p>}
      </div>
    </AppShell>
  );
}
