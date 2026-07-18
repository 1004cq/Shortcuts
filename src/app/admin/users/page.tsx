"use client";

import * as React from "react";
import { format } from "date-fns";
import { AdminShell } from "@/components/layout/AdminShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Trash2 } from "lucide-react";

type UserRow = {
  _id: string;
  name: string;
  email: string;
  username?: string | null;
  phone?: string | null;
  role: string;
  membership: string;
  emailVerified: boolean;
  createdAt: string;
  membershipExpiresAt?: string | null;
};

type EditForm = {
  name: string;
  email: string;
  username: string;
  phone: string;
  role: "user" | "vip";
  membership: "free" | "monthly" | "quarterly" | "yearly";
  membershipExpiresAt: string;
  emailVerified: boolean;
  password: string;
  passwordConfirm: string;
};

function toLocalInputValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(local: string): string | null {
  if (!local.trim()) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function AdminUsersPage() {
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<UserRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [editing, setEditing] = React.useState<UserRow | null>(null);
  const [form, setForm] = React.useState<EditForm | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [editError, setEditError] = React.useState("");
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const load = React.useCallback(async (query = "") => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载失败");
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setEditError("");
    setForm({
      name: u.name || "",
      email: u.email || "",
      username: u.username || "",
      phone: u.phone || "",
      role: u.role === "vip" ? "vip" : "user",
      membership: (u.membership as EditForm["membership"]) || "free",
      membershipExpiresAt: toLocalInputValue(u.membershipExpiresAt),
      emailVerified: Boolean(u.emailVerified),
      password: "",
      passwordConfirm: "",
    });
  };

  const setRoleQuick = async (userId: string, role: "user" | "vip") => {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        role,
        membership: role === "user" ? "free" : "monthly",
        membershipExpiresAt:
          role === "vip"
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : null,
      }),
    });
    if (res.ok) load(q);
  };

  const deleteUser = async (u: UserRow) => {
    const label = u.email || u.name || u._id;
    const ok = window.confirm(
      `确定删除用户「${label}」？\n此操作不可恢复，将同时清除其订阅与下载记录。`
    );
    if (!ok) return;
    setDeletingId(u._id);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u._id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      if (editing?._id === u._id) {
        setEditing(null);
        setForm(null);
      }
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !form) return;
    const newPassword = form.password.trim();
    if (newPassword || form.passwordConfirm.trim()) {
      if (newPassword !== form.passwordConfirm.trim()) {
        setEditError("两次输入的密码不一致");
        return;
      }
      if (newPassword.length < 8) {
        setEditError("密码至少 8 位");
        return;
      }
    }
    setSaving(true);
    setEditError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editing._id,
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          username: form.username.trim() ? form.username.trim().toLowerCase() : null,
          phone: form.phone.trim() ? form.phone.trim() : null,
          role: form.role,
          membership: form.membership,
          membershipExpiresAt: fromLocalInputValue(form.membershipExpiresAt),
          emailVerified: form.emailVerified,
          ...(newPassword ? { password: newPassword } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setEditing(null);
      setForm(null);
      await load(q);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title="用户管理">
      <p className="mb-3 text-xs text-slate-400">
        仅管理普通用户与 VIP。管理员账号请到「系统设置」修改。
      </p>
      <div className="mb-4 flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索邮箱 / 昵称 / 用户名 / 手机号"
          className="max-w-sm border-slate-700 bg-slate-900 text-slate-100"
        />
        <Button onClick={() => load(q)}>搜索</Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-slate-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">用户</TableHead>
                <TableHead className="text-slate-400">手机 / 用户名</TableHead>
                <TableHead className="text-slate-400">角色</TableHead>
                <TableHead className="text-slate-400">会员</TableHead>
                <TableHead className="text-slate-400">验证</TableHead>
                <TableHead className="text-slate-400">注册时间</TableHead>
                <TableHead className="text-right text-slate-400">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((u) => (
                <TableRow key={u._id} className="border-slate-800">
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-100">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-600">{u._id}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-300">
                    <div>{u.phone || "—"}</div>
                    <div className="text-xs text-slate-500">@{u.username || "未设置"}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant={u.membership === "free" ? "outline" : "vip"}>
                        {u.membership}
                      </Badge>
                      {u.membershipExpiresAt && (
                        <p className="text-[10px] text-slate-500">
                          至 {format(new Date(u.membershipExpiresAt), "yyyy-MM-dd")}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{u.emailVerified ? "是" : "否"}</TableCell>
                  <TableCell className="text-slate-400">
                    {format(new Date(u.createdAt), "yyyy-MM-dd")}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(u)}>
                      编辑
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRoleQuick(u._id, "user")}>
                      免费
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRoleQuick(u._id, "vip")}>
                      VIP
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deletingId === u._id}
                      onClick={() => void deleteUser(u)}
                    >
                      {deletingId === u._id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      删除
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={Boolean(editing && form)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setForm(null);
            setEditError("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-800 bg-slate-950 text-slate-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription className="text-slate-400">
              可修改普通用户资料、会员与密码。管理员请到系统设置。ID：{editing?._id}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <form onSubmit={saveEdit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-name">昵称</Label>
                  <Input
                    id="edit-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="border-slate-700 bg-slate-900"
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-email">邮箱</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="border-slate-700 bg-slate-900"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-username">用户名</Label>
                  <Input
                    id="edit-username"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="border-slate-700 bg-slate-900"
                    placeholder="可留空清除"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">手机号</Label>
                  <Input
                    id="edit-phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="border-slate-700 bg-slate-900"
                    placeholder="可留空清除"
                    maxLength={11}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">角色</Label>
                  <select
                    id="edit-role"
                    value={form.role}
                    onChange={(e) =>
                      setForm({ ...form, role: e.target.value as EditForm["role"] })
                    }
                    className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm"
                  >
                    <option value="user">user（免费）</option>
                    <option value="vip">vip</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-membership">会员套餐</Label>
                  <select
                    id="edit-membership"
                    value={form.membership}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        membership: e.target.value as EditForm["membership"],
                      })
                    }
                    className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm"
                  >
                    <option value="free">free</option>
                    <option value="monthly">monthly（月卡）</option>
                    <option value="quarterly">quarterly（季卡）</option>
                    <option value="yearly">yearly（年卡）</option>
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-expires">会员到期时间</Label>
                  <Input
                    id="edit-expires"
                    type="datetime-local"
                    value={form.membershipExpiresAt}
                    onChange={(e) =>
                      setForm({ ...form, membershipExpiresAt: e.target.value })
                    }
                    className="border-slate-700 bg-slate-900"
                  />
                  <p className="text-xs text-slate-500">留空表示无到期时间 / 清除到期</p>
                </div>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.emailVerified}
                    onChange={(e) =>
                      setForm({ ...form, emailVerified: e.target.checked })
                    }
                  />
                  邮箱已验证
                </label>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-password">新密码（可选）</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="border-slate-700 bg-slate-900"
                    placeholder="留空则不修改密码"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-password-confirm">确认新密码</Label>
                  <Input
                    id="edit-password-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={form.passwordConfirm}
                    onChange={(e) =>
                      setForm({ ...form, passwordConfirm: e.target.value })
                    }
                    className="border-slate-700 bg-slate-900"
                    placeholder="再次输入新密码"
                  />
                  <p className="text-xs text-slate-500">
                    至少 8 位，需包含字母和数字。管理员密码请在系统设置中修改。
                  </p>
                </div>
              </div>
              {editError && <p className="text-sm text-red-400">{editError}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!editing || deletingId === editing._id || saving}
                  onClick={() => editing && void deleteUser(editing)}
                >
                  {deletingId === editing?._id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  删除用户
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditing(null);
                      setForm(null);
                    }}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    保存
                  </Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
