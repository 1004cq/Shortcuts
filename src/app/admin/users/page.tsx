"use client";

import * as React from "react";
import { format } from "date-fns";
import { AdminShell } from "@/components/layout/AdminShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

type UserRow = {
  _id: string;
  name: string;
  email: string;
  role: string;
  membership: string;
  emailVerified: boolean;
  createdAt: string;
  membershipExpiresAt?: string | null;
};

export default function AdminUsersPage() {
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<UserRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

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

  const setRole = async (userId: string, role: "user" | "vip" | "admin") => {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        role,
        membership: role === "user" ? "free" : role === "vip" ? "monthly" : undefined,
        membershipExpiresAt:
          role === "vip"
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : role === "user"
              ? null
              : undefined,
      }),
    });
    if (res.ok) load(q);
  };

  return (
    <AdminShell title="用户管理">
      <div className="mb-4 flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索邮箱 / 昵称"
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
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.membership === "free" ? "outline" : "vip"}>
                      {u.membership}
                    </Badge>
                  </TableCell>
                  <TableCell>{u.emailVerified ? "是" : "否"}</TableCell>
                  <TableCell className="text-slate-400">
                    {format(new Date(u.createdAt), "yyyy-MM-dd")}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setRole(u._id, "user")}>
                      免费
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRole(u._id, "vip")}>
                      VIP
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRole(u._id, "admin")}>
                      管理员
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminShell>
  );
}
