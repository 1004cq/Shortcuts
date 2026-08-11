"use client";

import * as React from "react";
import { format } from "date-fns";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  AudioFilePicker,
  type AudioFileOption,
} from "@/components/admin/AudioFilePicker";
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
import { copyToClipboard } from "@/lib/clipboard";
import {
  Copy,
  Link2,
  Loader2,
  Music2,
  Plus,
  Trash2,
} from "lucide-react";

type ShortlinkInfo = {
  userId: string;
  fileId: string;
  fileName: string | null;
  remainingTimes: number;
  usedTimes: number;
  lastAccessTime: string | null;
  shortUrl: string;
};

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
  shortlink: ShortlinkInfo | null;
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

const USER_ID_RE = /^[a-zA-Z0-9]{2,8}$/;

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
  const [msg, setMsg] = React.useState("");

  const [editing, setEditing] = React.useState<UserRow | null>(null);
  const [form, setForm] = React.useState<EditForm | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [editError, setEditError] = React.useState("");
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Shortlink form state (inside edit dialog)
  const [slUserId, setSlUserId] = React.useState("");
  const [slAudio, setSlAudio] = React.useState<AudioFileOption | null>(null);
  const [slTimes, setSlTimes] = React.useState("10");
  const [slSaving, setSlSaving] = React.useState(false);
  const [slError, setSlError] = React.useState("");

  // Quick audio switch from list
  const [audioTarget, setAudioTarget] = React.useState<UserRow | null>(null);
  const [audioPick, setAudioPick] = React.useState<AudioFileOption | null>(null);
  const [audioSaving, setAudioSaving] = React.useState(false);

  // Quick recharge from list
  const [rechargeTarget, setRechargeTarget] = React.useState<UserRow | null>(null);
  const [rechargeTimes, setRechargeTimes] = React.useState("10");
  const [recharging, setRecharging] = React.useState(false);

  const load = React.useCallback(async (query = "") => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}&limit=50`);
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

  const flash = (text: string) => {
    setMsg(text);
    window.setTimeout(() => setMsg(""), 2500);
  };

  const syncShortlinkForm = (u: UserRow) => {
    if (u.shortlink) {
      setSlUserId(u.shortlink.userId);
      setSlAudio({
        _id: u.shortlink.fileId,
        name: u.shortlink.fileName || u.shortlink.fileId,
      });
      setSlTimes(String(u.shortlink.remainingTimes ?? 10));
    } else {
      const uname = (u.username || "").trim();
      setSlUserId(USER_ID_RE.test(uname) ? uname : "");
      setSlAudio(null);
      setSlTimes("10");
    }
    setSlError("");
  };

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
    syncShortlinkForm(u);
  };

  const randomShortId = async () => {
    const res = await fetch("/api/admin/shortlinks?action=random-id");
    const data = await res.json();
    if (res.ok && data.userId) setSlUserId(data.userId);
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
      `确定删除用户「${label}」？\n此操作不可恢复，将同时清除其订阅、下载记录与短链接。`
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

  /** Create or update shortlink bound to this MediaVault user */
  const saveShortlink = async () => {
    if (!editing) return;
    setSlSaving(true);
    setSlError("");
    try {
      if (!USER_ID_RE.test(slUserId.trim())) {
        throw new Error("短链接用户ID需为2-8位字母或数字");
      }
      if (!slAudio?._id) {
        throw new Error("请选择音频文件");
      }
      const times = Number(slTimes);
      if (!Number.isFinite(times) || times < 0) {
        throw new Error("次数无效");
      }

      if (editing.shortlink) {
        // Update audio + absolute remaining times
        if (slUserId.trim() !== editing.shortlink.userId) {
          throw new Error("已生成的短链接 userId 不可更改；如需更换请先删除短链接");
        }

        const res = await fetch("/api/admin/shortlinks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: editing.shortlink.userId,
            fileId: slAudio._id,
            remainingTimes: times,
            linkedUserId: editing._id,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "更新短链接失败");
        flash("短链接已更新");
      } else {
        const res = await fetch("/api/admin/shortlinks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: slUserId.trim(),
            fileId: slAudio._id,
            remainingTimes: times,
            linkedUserId: editing._id,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "生成短链接失败");
        flash("短链接已生成");
      }

      // refresh editing row
      const listRes = await fetch(`/api/admin/users?q=${encodeURIComponent(editing.email)}&limit=50`);
      const listData = await listRes.json();
      const fresh = (listData.items || []).find((u: UserRow) => u._id === editing._id);
      if (fresh) {
        setEditing(fresh);
        syncShortlinkForm(fresh);
      }
      await load(q);
    } catch (err) {
      setSlError(err instanceof Error ? err.message : "保存短链接失败");
    } finally {
      setSlSaving(false);
    }
  };

  const removeShortlink = async () => {
    if (!editing?.shortlink) return;
    if (!confirm(`确定删除短链接「${editing.shortlink.userId}」？`)) return;
    setSlSaving(true);
    setSlError("");
    try {
      const res = await fetch("/api/admin/shortlinks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editing.shortlink.userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      flash("短链接已删除");
      const updated = { ...editing, shortlink: null };
      setEditing(updated);
      syncShortlinkForm(updated);
      await load(q);
    } catch (err) {
      setSlError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setSlSaving(false);
    }
  };

  const copyAplLink = async (shortlink: ShortlinkInfo | null | undefined) => {
    if (!shortlink?.shortUrl && !shortlink?.userId) {
      flash("该用户尚未生成短链接");
      return;
    }
    const url =
      shortlink.shortUrl || `https://cq.imim.chat/apl/${shortlink.userId}`;
    const ok = await copyToClipboard(url);
    flash(ok ? `已复制：${url}` : "请手动复制短链接");
  };

  const saveAudioSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioTarget?.shortlink || !audioPick) return;
    setAudioSaving(true);
    try {
      const res = await fetch("/api/admin/shortlinks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: audioTarget.shortlink.userId,
          fileId: audioPick._id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "切换失败");
      setAudioTarget(null);
      setAudioPick(null);
      flash(`已切换音频：${audioPick.name}`);
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "切换失败");
    } finally {
      setAudioSaving(false);
    }
  };

  const doRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rechargeTarget?.shortlink) return;
    const times = Number(rechargeTimes);
    if (!Number.isFinite(times) || times <= 0) {
      setError("充值次数必须为正整数");
      return;
    }
    setRecharging(true);
    try {
      const res = await fetch("/api/admin/shortlinks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: rechargeTarget.shortlink.userId,
          addTimes: times,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "充值失败");
      setRechargeTarget(null);
      flash(`已充值 ${times} 次`);
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "充值失败");
    } finally {
      setRecharging(false);
    }
  };

  return (
    <AdminShell title="用户管理">
      <p className="mb-3 text-xs text-slate-400">
        管理普通用户 / VIP，并在本页配置每人的短链接（
        <code className="text-slate-300">/apl/&#123;userId&#125;</code>
        ）。管理员账号请到「系统设置」。
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索邮箱 / 昵称 / 用户名 / 手机号"
          className="max-w-sm border-slate-700 bg-slate-900 text-slate-100"
          onKeyDown={(e) => e.key === "Enter" && load(q)}
        />
        <Button onClick={() => load(q)}>搜索</Button>
      </div>

      {msg && <p className="mb-3 text-sm text-emerald-400">{msg}</p>}
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="flex h-32 items-center justify-center text-slate-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">用户</TableHead>
                <TableHead className="text-slate-400">短链接</TableHead>
                <TableHead className="text-slate-400">音频</TableHead>
                <TableHead className="text-slate-400">次数</TableHead>
                <TableHead className="text-slate-400">角色 / 会员</TableHead>
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
                      <p className="text-xs text-slate-600">
                        {u.phone || "—"} · @{u.username || "未设置"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.shortlink ? (
                      <div className="flex max-w-[220px] items-center gap-1">
                        <code className="truncate text-[11px] text-sky-300">
                          {u.shortlink.shortUrl}
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          title="复制短链接"
                          onClick={() => copyAplLink(u.shortlink)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">未生成</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.shortlink ? (
                      <div className="max-w-[140px]">
                        <p className="truncate text-sm text-slate-200">
                          {u.shortlink.fileName || "（文件缺失）"}
                        </p>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {u.shortlink ? (
                      <div className="space-y-1 text-xs">
                        <div>
                          剩余{" "}
                          <Badge variant="secondary">{u.shortlink.remainingTimes}</Badge>
                        </div>
                        <div className="text-slate-500">
                          已用 {u.shortlink.usedTimes}
                        </div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant="secondary">{u.role}</Badge>
                      <Badge variant={u.membership === "free" ? "outline" : "vip"}>
                        {u.membership}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(u)}>
                        编辑
                      </Button>
                      {u.shortlink ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyAplLink(u.shortlink)}
                          >
                            <Copy className="mr-1 h-3.5 w-3.5" />
                            复制链接
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAudioTarget(u);
                              setAudioPick({
                                _id: u.shortlink!.fileId,
                                name: u.shortlink!.fileName || u.shortlink!.fileId,
                              });
                            }}
                          >
                            <Music2 className="mr-1 h-3.5 w-3.5" />
                            选音频
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setRechargeTarget(u);
                              setRechargeTimes("10");
                            }}
                          >
                            充次
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          生成短链接
                        </Button>
                      )}
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
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit user + shortlink */}
      <Dialog
        open={Boolean(editing && form)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setForm(null);
            setEditError("");
            setSlError("");
          }
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto border-slate-800 bg-slate-950 text-slate-100 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription className="text-slate-400">
              资料、会员与短链接在此统一管理。ID：{editing?._id}
            </DialogDescription>
          </DialogHeader>
          {form && editing && (
            <div className="space-y-6">
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">手机号</Label>
                    <Input
                      id="edit-phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="border-slate-700 bg-slate-900"
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
                      <option value="monthly">monthly</option>
                      <option value="quarterly">quarterly</option>
                      <option value="yearly">yearly</option>
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
                      placeholder="留空则不修改"
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
                    />
                  </div>
                </div>
                {editError && <p className="text-sm text-red-400">{editError}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    保存资料
                  </Button>
                </div>
              </form>

              {/* Shortlink section */}
              <div className="space-y-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-sky-200">
                    <Link2 className="h-4 w-4" />
                    短链接管理
                  </h3>
                  {editing.shortlink && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => copyAplLink(editing.shortlink)}
                    >
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      复制短链接
                    </Button>
                  )}
                </div>

                {editing.shortlink && (
                  <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                    <p className="break-all font-mono text-sky-300">
                      {editing.shortlink.shortUrl}
                    </p>
                    <p className="mt-1 text-slate-500">
                      已用 {editing.shortlink.usedTimes} 次 · 最后访问{" "}
                      {editing.shortlink.lastAccessTime
                        ? format(
                            new Date(editing.shortlink.lastAccessTime),
                            "yyyy-MM-dd HH:mm:ss"
                          )
                        : "从未"}
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>短链接用户ID（2-8位字母数字）</Label>
                  <div className="flex gap-2">
                    <Input
                      value={slUserId}
                      onChange={(e) => setSlUserId(e.target.value)}
                      maxLength={8}
                      disabled={Boolean(editing.shortlink)}
                      className="border-slate-700 bg-slate-900"
                      placeholder="例如 a1b2"
                    />
                    {!editing.shortlink && (
                      <Button type="button" variant="outline" onClick={randomShortId}>
                        随机
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>选择音频文件</Label>
                  <AudioFilePicker value={slAudio?._id || null} onChange={setSlAudio} />
                </div>

                <div className="space-y-1.5">
                  <Label>
                    {editing.shortlink ? "剩余次数（可填更大值以充次）" : "初始次数"}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={slTimes}
                    onChange={(e) => setSlTimes(e.target.value)}
                    className="border-slate-700 bg-slate-900"
                  />
                </div>

                {slError && <p className="text-sm text-red-400">{slError}</p>}

                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={slSaving} onClick={() => void saveShortlink()}>
                    {slSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="mr-2 h-4 w-4" />
                    )}
                    {editing.shortlink ? "更新短链接" : "生成并绑定短链接"}
                  </Button>
                  {editing.shortlink && (
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={slSaving}
                      onClick={() => void removeShortlink()}
                    >
                      删除短链接
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deletingId === editing._id || saving}
                  onClick={() => void deleteUser(editing)}
                >
                  {deletingId === editing._id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  删除用户
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditing(null);
                    setForm(null);
                  }}
                >
                  关闭
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick switch audio */}
      <Dialog
        open={Boolean(audioTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setAudioTarget(null);
            setAudioPick(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>选择音频</DialogTitle>
            <DialogDescription>
              {audioTarget?.name} · 短链接{" "}
              {audioTarget?.shortlink?.userId}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveAudioSwitch}>
            <AudioFilePicker value={audioPick?._id || null} onChange={setAudioPick} />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setAudioTarget(null);
                  setAudioPick(null);
                }}
              >
                取消
              </Button>
              <Button type="submit" disabled={audioSaving || !audioPick}>
                {audioSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                确认
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick recharge */}
      <Dialog
        open={Boolean(rechargeTarget)}
        onOpenChange={(open) => !open && setRechargeTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>充值次数</DialogTitle>
            <DialogDescription>
              {rechargeTarget?.name} 当前剩余{" "}
              {rechargeTarget?.shortlink?.remainingTimes ?? 0}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={doRecharge}>
            <Input
              type="number"
              min={1}
              value={rechargeTimes}
              onChange={(e) => setRechargeTimes(e.target.value)}
              className="border-slate-700 bg-slate-900"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRechargeTarget(null)}>
                取消
              </Button>
              <Button type="submit" disabled={recharging}>
                {recharging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                确认充值
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
