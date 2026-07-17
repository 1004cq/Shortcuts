import * as React from "react";
import { cn } from "@/lib/utils";

type GlassCardProps = React.HTMLAttributes<HTMLDivElement> & {
  glow?: "cyan" | "violet" | "emerald" | "amber" | "none";
  hoverLift?: boolean;
};

const glowMap = {
  cyan: "before:from-sky-400/40 before:via-cyan-300/10 before:to-transparent",
  violet: "before:from-violet-400/40 before:via-fuchsia-300/10 before:to-transparent",
  emerald: "before:from-emerald-400/40 before:via-teal-300/10 before:to-transparent",
  amber: "before:from-amber-400/40 before:via-orange-300/10 before:to-transparent",
  none: "before:from-white/20 before:via-white/5 before:to-transparent",
};

export function GlassCard({
  className,
  glow = "none",
  hoverLift = true,
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "liquid-glass group relative overflow-hidden rounded-2xl",
        hoverLift &&
          "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-24px_rgba(56,189,248,0.45)]",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-2xl before:absolute before:inset-px before:rounded-[15px] before:bg-gradient-to-br before:opacity-70",
          glowMap[glow]
        )}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
