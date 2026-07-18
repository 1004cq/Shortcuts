"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { HardDrive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SessionUser } from "@/types";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    if (res?.error) {
      setLoading(false);
      setError(res.error === "CredentialsSignin" ? "邮箱或密码错误" : res.error);
      return;
    }

    const session = await getSession();
    const user = session?.user as SessionUser | undefined;
    const isAdminCallback =
      callbackUrl.startsWith("/admin") && !callbackUrl.startsWith("/admin/login");
    const dest =
      user?.role === "admin" && (callbackUrl === "/" || isAdminCallback)
        ? isAdminCallback
          ? callbackUrl
          : "/admin"
        : callbackUrl;

    router.push(dest);
    router.refresh();
  };

  return (
    <Card className="w-full max-w-md rounded-2xl border-border/80 bg-card/80 shadow-2xl shadow-primary/5 backdrop-blur">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
          <HardDrive className="h-6 w-6" />
        </div>
        <CardTitle className="font-display text-xl sm:text-2xl">登录 MediaVault</CardTitle>
        <CardDescription>安全访问你的媒体文件库</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            登录
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          还没有账号？{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            立即注册
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div
      data-scroll-root
      className="scroll-root relative flex h-full min-h-0 items-center justify-center overflow-y-auto px-4 py-10 safe-pb"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.18),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom_right,transparent,rgba(16,185,129,0.05))]" />
      <React.Suspense fallback={<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}>
        <LoginForm />
      </React.Suspense>
    </div>
  );
}
