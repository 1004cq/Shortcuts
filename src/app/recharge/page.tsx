"use client";

import * as React from "react";
import { format } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Coins, Loader2, Sparkles } from "lucide-react";

type Pack = {
  _id: string;
  label: string;
  times: number;
  priceYuan: number;
  highlighted?: boolean;
};

type Balance = {
  remainingTimes: number;
  usedTimes: number;
  shortlinkUserId?: string;
};

type OrderRow = {
  _id: string;
  times: number;
  amount: number;
  status: string;
  createdAt: string | null;
};

export default function RechargePage() {
  const [packs, setPacks] = React.useState<Pack[]>([]);
  const [balance, setBalance] = React.useState<Balance | null>(null);
  const [orders, setOrders] = React.useState<OrderRow[]>([]);
  const [payment, setPayment] = React.useState<{ alipay: boolean; demo: boolean } | null>(
    null
  );
  const [loading, setLoading] = React.useState(true);
  const [buying, setBuying] = React.useState<string | null>(null);
  const [customTimes, setCustomTimes] = React.useState("20");
  const [error, setError] = React.useState("");
  const [msg, setMsg] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/play-orders");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载失败");
      setPacks(data.packs || []);
      setBalance(data.balance || null);
      setOrders(data.orders || []);
      setPayment(data.payment || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const unitPrice = React.useMemo(() => {
    let best = Infinity;
    for (const p of packs) {
      if (p.times > 0) best = Math.min(best, p.priceYuan / p.times);
    }
    return Number.isFinite(best) ? best : 0;
  }, [packs]);

  const checkout = async (opts: { packId?: string; customTimes?: number }) => {
    setBuying(opts.packId || "custom");
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/play-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "下单失败");

      if (data.mode === "alipay" && data.payForm) {
        setMsg("正在跳转支付宝…");
        const box = document.createElement("div");
        box.style.display = "none";
        box.innerHTML = data.payForm as string;
        document.body.appendChild(box);
        const form = box.querySelector("form");
        if (!form) throw new Error("未拿到支付宝支付表单");
        form.submit();
        return;
      }

      setMsg(data.message || "充值成功");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "下单失败");
    } finally {
      setBuying(null);
    }
  };

  return (
    <AppShell showUpload={false} showSearch={false} title="充值次数">
      <div className="mx-auto w-full min-w-0 max-w-lg space-y-4 animate-slide-up sm:max-w-xl sm:space-y-5">
        <div className="text-center">
          <Badge variant="secondary" className="mb-2">
            <Coins className="mr-1 h-3 w-3" />
            播放次数
          </Badge>
          <h1 className="font-display text-xl font-bold sm:text-2xl">充值播放次数</h1>
          <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
            短链接每次成功播放扣 1 次；次数为 0 时无法播放。
            {payment?.alipay
              ? " 支持支付宝支付。"
              : payment?.demo
                ? " 当前为演示模式（未配置支付宝时可直接到账）。"
                : ""}
          </p>
        </div>

        {loading ? (
          <div className="flex h-28 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中…
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4">
              <div>
                <p className="text-[11px] text-slate-400">剩余次数</p>
                <p className="mt-1 font-display text-3xl font-bold text-sky-300">
                  {balance?.remainingTimes ?? 0}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">已使用</p>
                <p className="mt-1 font-display text-3xl font-bold text-slate-200">
                  {balance?.usedTimes ?? 0}
                </p>
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-100">选择档位</h2>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {packs.map((pack) => (
                  <button
                    key={pack._id}
                    type="button"
                    disabled={Boolean(buying)}
                    onClick={() => void checkout({ packId: pack._id })}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition active:scale-[0.98]",
                      pack.highlighted
                        ? "border-sky-400 bg-sky-500/15"
                        : "border-white/10 bg-white/5"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-100">{pack.label}</p>
                      {pack.highlighted && (
                        <Sparkles className="h-4 w-4 text-sky-300" />
                      )}
                    </div>
                    <p className="mt-1 text-2xl font-bold text-sky-300">
                      ¥{pack.priceYuan}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{pack.times} 次播放</p>
                    <p className="mt-3 text-sm text-sky-200">
                      {buying === pack._id ? "处理中…" : "立即充值"}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-sm font-semibold text-slate-100">自定义次数</h2>
              <p className="text-[11px] text-slate-500">
                参考单价约 ¥{unitPrice.toFixed(2)} / 次（按当前最划算档位折算）
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={customTimes}
                  onChange={(e) => setCustomTimes(e.target.value)}
                  className="bg-background/60"
                />
                <Button
                  type="button"
                  disabled={Boolean(buying)}
                  onClick={() => {
                    const n = Number(customTimes);
                    if (!Number.isFinite(n) || n < 1) {
                      setError("请输入有效次数");
                      return;
                    }
                    void checkout({ customTimes: Math.floor(n) });
                  }}
                >
                  {buying === "custom" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "充值"
                  )}
                </Button>
              </div>
              {Number(customTimes) > 0 && unitPrice > 0 && (
                <p className="text-xs text-slate-400">
                  预计 ¥{(unitPrice * Number(customTimes)).toFixed(2)}
                </p>
              )}
            </section>

            {orders.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-100">最近订单</h2>
                <ul className="space-y-1.5">
                  {orders.slice(0, 8).map((o) => (
                    <li
                      key={o._id}
                      className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-xs"
                    >
                      <span>
                        +{o.times} 次 · ¥{o.amount}
                        <span className="ml-2 text-slate-500">
                          {o.createdAt
                            ? format(new Date(o.createdAt), "MM-dd HH:mm")
                            : ""}
                        </span>
                      </span>
                      <Badge variant="outline">{o.status}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {msg && <p className="text-center text-sm text-emerald-400">{msg}</p>}
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </div>
    </AppShell>
  );
}
