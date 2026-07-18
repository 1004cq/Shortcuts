"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Loader2, Save, Shield } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { GlassCard } from "@/components/admin/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AdminProfile = {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  phone?: string | null;
  role: string;
};

export default function AdminSettingsPage() {
  const { update } = useSession();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [profile, setProfile] = React.useState<AdminProfile | null>(null);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [passwordConfirm, setPasswordConfirm] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载失败");
      const item = data.item as AdminProfile;
      setProfile(item);
      setName(item.name || "");
      setEmail(item.email || "");
      setUsername(item.username || "");
      setPhone(item.phone || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const newPassword = password.trim();
    if (newPassword || passwordConfirm.trim() || currentPassword.trim()) {
      if (!currentPassword.trim()) {
        setError("修改密码需填写当前密码");
        return;
      }
      if (!newPassword) {
        setError("请填写新密码");
        return;
      }
      if (newPassword !== passwordConfirm.trim()) {
        setError("两次输入的新密码不一致");
        return;
      }
    }

    setSaving(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          username: username.trim() ? username.trim().toLowerCase() : null,
          phone: phone.trim() ? phone.trim() : null,
          ...(newPassword
            ? {
                currentPassword: currentPassword.trim(),
                password: newPassword,
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      const item = data.item as AdminProfile;
      setProfile(item);
      setCurrentPassword("");
      setPassword("");
      setPasswordConfirm("");
      setMsg(data.message || "已保存");
      await update({
        name: item.name,
        email: item.email,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title="系统设置">
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            System Settings
          </p>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            管理员账号
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            管理员资料与密码仅在此修改；用户管理中不会出现管理员账号。
          </p>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中…
          </div>
        ) : (
          <GlassCard glow="cyan" className="space-y-5 p-5">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-sky-300" />
              <div>
                <p className="font-display font-semibold">当前管理员</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {profile?.id}
                </p>
              </div>
            </div>

            <form onSubmit={save} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="admin-name">昵称</Label>
                  <Input
                    id="admin-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border-white/10 bg-black/20"
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="admin-email">登录邮箱</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-white/10 bg-black/20"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-username">用户名</Label>
                  <Input
                    id="admin-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="border-white/10 bg-black/20"
                    placeholder="可留空"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-phone">手机号</Label>
                  <Input
                    id="admin-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="border-white/10 bg-black/20"
                    placeholder="可留空"
                    maxLength={11}
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-medium">修改密码</p>
                <p className="text-xs text-muted-foreground">
                  不改密码请全部留空。新密码至少 8 位，需包含字母和数字。
                </p>
                <div className="space-y-2">
                  <Label htmlFor="current-password">当前密码</Label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="border-white/10 bg-black/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">新密码</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-white/10 bg-black/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">确认新密码</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="border-white/10 bg-black/20"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}
              {msg && <p className="text-sm text-emerald-300">{msg}</p>}

              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                保存设置
              </Button>
            </form>
          </GlassCard>
        )}
      </div>
    </AdminShell>
  );
}
