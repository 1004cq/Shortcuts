"use client";

import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/admin/GlassCard";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  glow?: "cyan" | "violet" | "emerald" | "amber";
  accentClass?: string;
};

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  glow = "cyan",
  accentClass = "text-sky-300",
}: KpiCardProps) {
  return (
    <GlassCard glow={glow} className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 shadow-inner backdrop-blur",
            accentClass
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </GlassCard>
  );
}
