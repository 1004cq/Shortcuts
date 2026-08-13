"use client";

import * as React from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

type Pack = {
  _id: string;
  label: string;
  times: number;
  priceYuan: number;
  enabled: boolean;
  sort: number;
  highlighted: boolean;
};

const emptyForm = {
  label: "",
  times: "10",
  priceYuan: "5",
  sort: "0",
  enabled: true,
  highlighted: false,
};

export default function AdminPlayPacksPage() {
  const [items, setItems] = React.useState<Pack[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [editing, setEditing] = React.useState<Pack | null>(null);
  const [form, setForm] = React.useState(emptyForm);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/play-packs");
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
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const openEdit = (p: Pack) => {
    setEditing(p);
    setForm({
      label: p.label,
      times: String(p.times),
      priceYuan: String(p.priceYuan),
      sort: String(p.sort),
      enabled: p.enabled,
      highlighted: p.highlighted,
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/admin/play-packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _id: editing?._id,
          label: form.label.trim(),
          times: Number(form.times),
          priceYuan: Number(form.priceYuan),
          sort: Number(form.sort) || 0,
          enabled: form.enabled,
          highlighted: form.highlighted,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setMsg(editing ? "已更新" : "已添加");
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Pack) => {
    if (!confirm(`删除档位「${p.label}」？`)) return;
    const res = await fetch("/api/admin/play-packs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _id: p._id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "删除失败");
      return;
    }
    await load();
  };

  return (
    <AdminShell title="次数价格">
      <p className="mb-4 text-xs text-slate-400">
        配置用户端「充值」页的次数包价格。自定义次数按当前最划算档位的单价折算。
      </p>

      <div className="mb-4 flex gap-2">
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          新建档位
        </Button>
      </div>

      {msg && <p className="mb-2 text-sm text-emerald-400">{msg}</p>}
      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="flex h-24 items-center justify-center text-slate-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中…
        </div>
      ) : (
        <div className="mb-6 space-y-2">
          {items.map((p) => (
            <div
              key={p._id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-100">
                  {p.label}{" "}
                  {!p.enabled && (
                    <Badge variant="outline" className="ml-1">
                      已下架
                    </Badge>
                  )}
                  {p.highlighted && (
                    <Badge variant="secondary" className="ml-1">
                      推荐
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {p.times} 次 · ¥{p.priceYuan} · 排序 {p.sort}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(p)}>
                  编辑
                </Button>
                <Button size="sm" variant="destructive" onClick={() => void remove(p)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={save}
        className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
      >
        <h3 className="text-sm font-semibold text-slate-200">
          {editing ? `编辑：${editing.label}` : "新建档位"}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>名称</Label>
            <Input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              required
              className="border-slate-700 bg-slate-950"
            />
          </div>
          <div className="space-y-1.5">
            <Label>次数</Label>
            <Input
              type="number"
              min={1}
              value={form.times}
              onChange={(e) => setForm({ ...form, times: e.target.value })}
              required
              className="border-slate-700 bg-slate-950"
            />
          </div>
          <div className="space-y-1.5">
            <Label>价格（元）</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.priceYuan}
              onChange={(e) => setForm({ ...form, priceYuan: e.target.value })}
              required
              className="border-slate-700 bg-slate-950"
            />
          </div>
          <div className="space-y-1.5">
            <Label>排序</Label>
            <Input
              type="number"
              value={form.sort}
              onChange={(e) => setForm({ ...form, sort: e.target.value })}
              className="border-slate-700 bg-slate-950"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            上架
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.highlighted}
              onChange={(e) => setForm({ ...form, highlighted: e.target.checked })}
            />
            推荐高亮
          </label>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          保存
        </Button>
      </form>
    </AdminShell>
  );
}
