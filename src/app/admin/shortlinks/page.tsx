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
import { copyToClipboard } from "@/lib/clipboard";
import { Copy, Link2, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

type ShortlinkRow = {
  _id: string;
  userId: string;
  fileId: string;
  remainingTimes: number;
  usedTimes: number;
  lastAccessTime: string | null;
  createdAt: string | null;
  shortUrl: string;
};

export default function AdminShortlinksPage() {
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<ShortlinkRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [msg, setMsg] = React.useState("");

  const [createOpen, setCreateOpen] = React.useState(false);
  const [newUserId, setNewUserId] = React.useState("");
  const [newFileId, setNewFileId] = React.useState("");
  const [newTimes, setNewTimes] = React.useState("10");
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState("");

  const [fileEdit, setFileEdit] = React.useState<ShortlinkRow | null>(null);
  const [fileIdInput, setFileIdInput] = React.useState("");
  const [savingFile, setSavingFile] = React.useState(false);

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

  React.useEffect(() => {
    load();
  }, [load]);

  const flash = (text: string) => {
    setMsg(text);
    window.setTimeout(() => setMsg(""), 2500);
  };

  const randomId = async () => {
    const res = await fetch("/api/admin/shortlinks?action=random-id");
    const data = await res.json();
    if (res.ok && data.userId) {
      setNewUserId(data.userId);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/admin/shortlinks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: newUserId.trim(),
          fileId: newFileId.trim(),
          remainingTimes: Number(newTimes) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "添加失败");
      setCreateOpen(false);
      setNewUserId("");
      setNewFileId("");
      setNewTimes("10");
      flash("已添加短链接用户");
      await load(q);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setCreating(false);
    }
  };

  const saveFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileEdit) return;
    setSavingFile(true);
    setError("");
    try {
      const res = await fetch("/api/admin/shortlinks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: fileEdit.userId,
          fileId: fileIdInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "修改失败");
      setFileEdit(null);
      flash("音频已更新");
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "修改失败");
    } finally {
      setSavingFile(false);
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
            用户在苹果快捷指令中只需填写固定短链接：
            <code className="mx-1 rounded bg-black/20 px-1.5 py-0.5 text-foreground">
              https://cq.imim.chat/apl/&#123;userId&#125;
            </code>
          </p>
          <p className="mt-1">
            每次成功播放扣 1 次；后台更换 fileId 后，用户无需修改快捷指令。使用 MediaVault
            管理员登录，无需单独账号。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索用户ID / 文件ID"
            className="max-w-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") load(q);
            }}
          />
          <Button variant="secondary" onClick={() => load(q)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">刷新</span>
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
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
                <TableHead>剩余次数</TableHead>
                <TableHead>已使用</TableHead>
                <TableHead>fileId</TableHead>
                <TableHead>最后访问</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    暂无短链接用户
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell className="font-medium">{row.userId}</TableCell>
                    <TableCell>
                      <div className="flex max-w-[240px] items-center gap-1">
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
                      <Badge variant="secondary">{row.remainingTimes}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.usedTimes}</Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{row.fileId}</code>
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
                          variant="outline"
                          onClick={() => {
                            setFileEdit(row);
                            setFileIdInput(row.fileId);
                          }}
                        >
                          换音频
                        </Button>
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
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加短链接用户</DialogTitle>
            <DialogDescription>
              用户ID 为 2–8 位字母或数字；fileId 为 MediaVault 文件管理中的音频 ID。
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={createUser}>
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
            <div className="space-y-1.5">
              <Label htmlFor="newFileId">音频文件 ID</Label>
              <Input
                id="newFileId"
                value={newFileId}
                onChange={(e) => setNewFileId(e.target.value)}
                placeholder="Mongo ObjectId"
                required
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
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                添加
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change file */}
      <Dialog
        open={Boolean(fileEdit)}
        onOpenChange={(open) => !open && setFileEdit(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>更换音频</DialogTitle>
            <DialogDescription>
              用户 {fileEdit?.userId} — 更换后短链接不变，快捷指令无需修改。
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={saveFile}>
            <div className="space-y-1.5">
              <Label htmlFor="fileIdInput">新的音频文件 ID</Label>
              <Input
                id="fileIdInput"
                value={fileIdInput}
                onChange={(e) => setFileIdInput(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setFileEdit(null)}>
                取消
              </Button>
              <Button type="submit" disabled={savingFile}>
                {savingFile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
