"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function VerifyInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = React.useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("缺少验证令牌");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "验证失败");
        setStatus("ok");
        setMessage(data.message || "验证成功");
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "验证失败");
      }
    })();
  }, [token]);

  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle className="font-display text-2xl">邮箱验证</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            正在验证...
          </div>
        )}
        {status === "ok" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <p>{message}</p>
            <Button asChild>
              <Link href="/login">去登录</Link>
            </Button>
          </div>
        )}
        {status === "error" && (
          <div className="flex flex-col items-center gap-3">
            <XCircle className="h-10 w-10 text-destructive" />
            <p className="text-destructive">{message}</p>
            <Button asChild variant="outline">
              <Link href="/register">重新注册</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyPage() {
  return (
    <div
      data-scroll-root
      className="scroll-root flex h-full min-h-0 items-center justify-center overflow-y-auto px-4"
    >
      <React.Suspense fallback={<Loader2 className="h-6 w-6 animate-spin" />}>
        <VerifyInner />
      </React.Suspense>
    </div>
  );
}
