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
import { cn } from "@/lib/utils";
import {
  Copy,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
} from "lucide-react";

type ShortlinkRow = {
  _id: string;
  userId: string;
  fileId: string;
  fileName: string | null;
  remainingTimes: number;
  usedTimes: number;
  lastAccessTime: string | null;
  createdAt: string | null;
  shortUrl: string;
  linkedUserId: string | null;
  linkedUserName: string | null;
  linkedUserEmail: string | null;
  linkedUsername: string | null;
};

type MvUserOption = {
  _id: string;
  name: string;
  email: string;
  username?: string | null;
};

const USER_ID_RE = /^[a-zA-Z0-9]{2,8}$/;

export default function AdminShortlinksPage() {
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<ShortlinkRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [msg, setMsg] = React.useState("");

  const [mvUsers, setMvUsers] = React.useState<MvUserOption[]>([]);
  const [mvUserQ, setMvUserQ] = React.useState("");

  const [createOpen, setCreateOpen] = React.useState(false);
  const [userMode, setUserMode] = React.useState<"pick" | "manual">("manual");
  const [newUserId, setNewUserId] = React.useState("");
  const [linkedUserId, setLinkedUserId] = React.useState<string | null>(null);
  const [selectedAudio, setSelectedAudio] = React.useState<AudioFileOption | null>(
    null
  );
  const [newTimes, setNewTimes] = React.useState("10");
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState("");

  const [audioTarget, setAudioTarget] = React.useState<ShortlinkRow | null>(null);
  const [audioPick, setAudioPick] = React.useState<AudioFileOption | null>(null);
  const [savingAudio, setSavingAudio] = React.useState(false);

  const [editTarget, setEditTarget] = React.useState<ShortlinkRow | null>(null);
  const [editLinkedId, setEditLinkedId] = React.useState<string | null>(null);
  const [savingEdit, setSavingEdit] = React.useState(false);

  const [rechargeTarget, setRechargeTarget] = React.useState<ShortlinkRow | null>(
    null
  );
  const [rechargeTimes, setRechargeTimes] = React.useState("10");
  const [recharging, setRecharging] = React.useState(false);

  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const load = React.useCallback(async (query = "") => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/shortlinks?q=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载失败");
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMvUsers = React.useCallback(async (query = "") => {
    try {
      const res = await fetch(
        `/api/admin/users?limit=50&q=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      if (!res.ok) return;
      setMvUsers(
        (data.items || []).map(
          (u: {
            _id: string;
            name: string;
            email: string;
            username?: string | null;
          }) => ({
            _id: u._id,
            name: u.name,
            email: u.email,
            username: u.username,
          })
        )
      );
    } catch {
      // ignore — picker still works in manual mode
    }
  }, []);

  React.useEffect(() => {
    load();
    loadMvUsers();
  }, [load, loadMvUsers]);

  React.useEffect(() => {
    const t = window.setTimeout(() => loadMvUsers(mvUserQ), 280);
    return () => window.clearTimeout(t);
  }, [mvUserQ, loadMvUsers]);

  const flash = (text: string) => {
    setMsg(text);
    window.setTimeout(() => setMsg(""), 2500);
  };

  const resetCreateForm = () => {
    setUserMode("manual");
    setNewUserId("");
    setLinkedUserId(null);
    setSelectedAudio(null);
    setNewTimes("10");
    setCreateError("");
    setMvUserQ("");
  };

  const randomId = async () => {
    const res = await fetch("/api/admin/shortlinks?action=random-id");
    const data = await res.json();
    if (res.ok && data.userId) {
      setNewUserId(data.userId);
      setUserMode("manual");
    }
  };

  const pickMvUser = (u: MvUserOption) => {
    setLinkedUserId(u._id);
    setUserMode("pick");
    // Prefer valid username as shortlink userId when available
    const candidate = (u.username || "").trim();
    if (USER_ID_RE.test(candidate)) {
      setNewUserId(candidate);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    try {
      if (!USER_ID_RE.test(newUserId.trim())) {
        throw new Error("用户ID需为2-8位字母或数字");
      }
      if (!selectedAudio?._id) {
        throw new Error("请选择音频文件");
      }
      const res = await fetch("/api/admin/shortlinks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: newUserId.trim(),
          fileId: selectedAudio._id,
          remainingTimes: Number(newTimes) || 0,
          linkedUserId: linkedUserId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "添加失败");
      setCreateOpen(false);
      resetCreateForm();
      flash("已添加短链接用户");
      await load(q);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setCreating(false);
    }
  };

  const saveAudio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioTarget || !audioPick) return;
    setSavingAudio(true);
    setError("");
    try {
      const res = await fetch("/api/admin/shortlinks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: audioTarget.userId,
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
      setSavingAudio(false);
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSavingEdit(true);
    setError("");
    try {
      const res = await fetch("/api/admin/shortlinks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editTarget.userId,
          linkedUserId: editLinkedId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setEditTarget(null);
      flash("已更新绑定用户");
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSavingEdit(false);
    }
  };

  const doRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rechargeTarget) return;
    const times = Number(rechargeTimes);
    if (!Number.isFinite(times) || times <= 0) {
      setError("充值次数必须为正整数");
      return;
    }
    setRecharging(true);
    setError("");
    try {
      const res = await fetch("/api/admin/shortlinks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: rechargeTarget.userId,
          addTimes: times,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "充值失败");
      setRechargeTarget(null);
      flash(`已为 ${rechargeTarget.userId} 充值 ${times} 次`);
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "充值失败");
    } finally {
      setRecharging(false);
    }
  };

  const deleteUser = async (row: ShortlinkRow) => {
    const ok = window.confirm(
      `确定删除短链接用户「${row.userId}」？\n此操作不可恢复。`
    );
    if (!ok) return;
    setDeletingId(row.userId);
    setError("");
    try {
      const res = await fetch("/api/admin/shortlinks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: row.userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      flash("已删除");
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  const copyLink = async (row: ShortlinkRow) => {
    const ok = await copyToClipboard(row.shortUrl);
    flash(ok ? `已复制：${row.shortUrl}` : "请手动复制短链接");
  };

  return (
    <AdminShell title="短链接管理">
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
          <p>
            用户快捷指令只需填写：
            <code className="mx-1 rounded bg-black/20 px-1.5 py-0.5 text-foreground">
              https://cq.imim.chat/apl/&#123;userId&#125;
            </code>
          </p>
          <p className="mt-1">
            添加/切换音频请从已上传音频列表中选择，无需手填 fileId。可绑定 MediaVault
            会员账号便于管理。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索用户ID / 音频名"
            className="max-w-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") load(q);
            }}
          />
          <Button variant="secondary" onClick={() => load(q)} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">刷新</span>
          </Button>
          <Button
            onClick={() => {
              resetCreateForm();
              setCreateOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            添加用户
          </Button>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {msg && <p className="text-sm text-emerald-500">{msg}</p>}

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户ID</TableHead>
                <TableHead>短链接</TableHead>
                <TableHead>音频文件</TableHead>
                <TableHead>绑定账号</TableHead>
                <TableHead>剩余</TableHead>
                <TableHead>已用</TableHead>
                <TableHead>最后访问</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    暂无短链接用户
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell className="font-medium">{row.userId}</TableCell>
                    <TableCell>
                      <div className="flex max-w-[220px] items-center gap-1">
                        <code className="truncate text-xs">{row.shortUrl}</code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          onClick={() => copyLink(row)}
                          title="复制短链接"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[180px]">
                        <p className="truncate text-sm font-medium">
                          {row.fileName || "（文件已删除）"}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {row.fileId}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.linkedUserName || row.linkedUserEmail ? (
                        <div className="max-w-[140px]">
                          <p className="truncate text-foreground">
                            {row.linkedUserName || "—"}
                          </p>
                          <p className="truncate">{row.linkedUserEmail}</p>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.remainingTimes}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.usedTimes}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {row.lastAccessTime
                        ? format(new Date(row.lastAccessTime), "yyyy-MM-dd HH:mm:ss")
                        : "从未访问"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setRechargeTarget(row);
                            setRechargeTimes("10");
                          }}
                        >
                          充次
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAudioTarget(row);
                            setAudioPick(
                              row.fileId
                                ? {
                                    _id: row.fileId,
                                    name: row.fileName || row.fileId,
                                  }
                                : null
                            );
                          }}
                        >
                          切换音频
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditTarget(row);
                            setEditLinkedId(row.linkedUserId);
                            setMvUserQ("");
                            loadMvUsers();
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deletingId === row.userId}
                          onClick={() => deleteUser(row)}
                        >
                          {deletingId === row.userId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>添加短链接用户</DialogTitle>
            <DialogDescription>
              绑定 MediaVault 用户或手动设置 userId；从音频列表中选择文件，无需手填
              fileId。
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={createUser}>
            <div className="space-y-2">
              <Label>用户绑定</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={userMode === "pick" ? "default" : "outline"}
                  onClick={() => setUserMode("pick")}
                >
                  选择会员
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={userMode === "manual" ? "default" : "outline"}
                  onClick={() => setUserMode("manual")}
                >
                  手动 / 随机 ID
                </Button>
              </div>

              {userMode === "pick" ? (
                <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                  <Input
                    value={mvUserQ}
                    onChange={(e) => setMvUserQ(e.target.value)}
                    placeholder="搜索会员邮箱 / 姓名 / 用户名"
                  />
                  <div className="max-h-36 space-y-1 overflow-y-auto">
                    {mvUsers.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">
                        无匹配会员
                      </p>
                    ) : (
                      mvUsers.map((u) => {
                        const active = linkedUserId === u._id;
                        return (
                          <button
                            key={u._id}
                            type="button"
                            onClick={() => pickMvUser(u)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm",
                              active ? "bg-sky-500/20" : "hover:bg-white/5"
                            )}
                          >
                            <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">
                                {u.name}
                                {u.username ? ` · ${u.username}` : ""}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {u.email}
                              </span>
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pickedUserId">短链接用户ID</Label>
                    <div className="flex gap-2">
                      <Input
                        id="pickedUserId"
                        value={newUserId}
                        onChange={(e) => setNewUserId(e.target.value)}
                        placeholder="2-8位字母数字"
                        maxLength={8}
                        required
                      />
                      <Button type="button" variant="outline" onClick={randomId}>
                        随机
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="newUserId">用户ID</Label>
                  <div className="flex gap-2">
                    <Input
                      id="newUserId"
                      value={newUserId}
                      onChange={(e) => setNewUserId(e.target.value)}
                      placeholder="例如 demo01"
                      maxLength={8}
                      required
                    />
                    <Button type="button" variant="outline" onClick={randomId}>
                      随机
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>选择音频文件</Label>
              <AudioFilePicker
                value={selectedAudio?._id || null}
                onChange={setSelectedAudio}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newTimes">初始次数</Label>
              <Input
                id="newTimes"
                type="number"
                min={0}
                value={newTimes}
                onChange={(e) => setNewTimes(e.target.value)}
              />
            </div>

            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="mr-2 h-4 w-4" />
                )}
                添加
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Switch audio */}
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
            <DialogTitle>切换音频</DialogTitle>
            <DialogDescription>
              用户 {audioTarget?.userId} — 从列表选择新音频，短链接不变。
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveAudio}>
            <AudioFilePicker
              value={audioPick?._id || null}
              onChange={setAudioPick}
            />
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
              <Button type="submit" disabled={savingAudio || !audioPick}>
                {savingAudio && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                确认切换
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit linked user */}
      <Dialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑绑定</DialogTitle>
            <DialogDescription>
              短链接用户 {editTarget?.userId} — 可绑定或解除 MediaVault 会员。
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={saveEdit}>
            <Input
              value={mvUserQ}
              onChange={(e) => setMvUserQ(e.target.value)}
              placeholder="搜索会员…"
            />
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/10 p-1">
              <button
                type="button"
                onClick={() => setEditLinkedId(null)}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-sm",
                  editLinkedId === null ? "bg-sky-500/20" : "hover:bg-white/5"
                )}
              >
                不绑定会员
              </button>
              {mvUsers.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => setEditLinkedId(u._id)}
                  className={cn(
                    "flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm",
                    editLinkedId === u._id ? "bg-sky-500/20" : "hover:bg-white/5"
                  )}
                >
                  <span className="font-medium">
                    {u.name}
                    {u.username ? ` · ${u.username}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditTarget(null)}>
                取消
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Recharge */}
      <Dialog
        open={Boolean(rechargeTarget)}
        onOpenChange={(open) => !open && setRechargeTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>充值次数</DialogTitle>
            <DialogDescription>
              为用户 {rechargeTarget?.userId} 增加播放次数（当前剩余{" "}
              {rechargeTarget?.remainingTimes ?? 0}）。
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={doRecharge}>
            <div className="space-y-1.5">
              <Label htmlFor="rechargeTimes">增加次数</Label>
              <Input
                id="rechargeTimes"
                type="number"
                min={1}
                value={rechargeTimes}
                onChange={(e) => setRechargeTimes(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRechargeTarget(null)}
              >
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
