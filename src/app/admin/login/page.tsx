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

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";
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
    });
    if (res?.error) {
      setLoading(false);
      setError(res.error === "CredentialsSignin" ? "邮箱或密码错误" : res.error);
      return;
    }

    const session = await getSession();
    const user = session?.user as SessionUser | undefined;
    if (user?.role !== "admin") {
      setLoading(false);
      setError("需要管理员账号才能进入后台");
      return;
    }

    const target =
      callbackUrl.startsWith("/admin") && !callbackUrl.startsWith("/admin/login")
        ? callbackUrl
        : "/admin";
    router.push(target);
    router.refresh();
  };

  return (
    <Card className="w-full max-w-md rounded-2xl border-slate-800 bg-slate-950/90 text-slate-100 shadow-2xl shadow-black/40">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
          <HardDrive className="h-6 w-6" />
        </div>
        <CardTitle className="font-display text-xl sm:text-2xl">管理后台</CardTitle>
        <CardDescription className="text-slate-400">
          cq.imim.chat/admin · 仅管理员可登录
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-email">管理员邮箱</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@mediavault.local"
              className="border-slate-700 bg-slate-900 text-slate-100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">密码</Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-slate-700 bg-slate-900 text-slate-100"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            进入后台
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/" className="font-medium text-primary hover:underline">
            返回前台
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function AdminLoginPage() {
  return (
    <div
      data-scroll-root
      className="scroll-root relative flex h-full min-h-0 items-center justify-center overflow-y-auto bg-[#0b1220] px-4 py-10"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.16),_transparent_55%)]" />
      <React.Suspense fallback={<Loader2 className="h-6 w-6 animate-spin text-slate-400" />}>
        <AdminLoginForm />
      </React.Suspense>
    </div>
  );
}
