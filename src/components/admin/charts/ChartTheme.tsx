"use client";

import { useTheme } from "next-themes";
import * as React from "react";

export function useChartColors() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== "light";

  return React.useMemo(
    () => ({
      grid: dark ? "rgba(148,163,184,0.12)" : "rgba(100,116,139,0.18)",
      axis: dark ? "rgba(148,163,184,0.75)" : "rgba(71,85,105,0.85)",
      tooltipBg: dark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.95)",
      tooltipBorder: dark ? "rgba(148,163,184,0.25)" : "rgba(148,163,184,0.35)",
      tooltipText: dark ? "#e2e8f0" : "#0f172a",
      linePrimary: "#38bdf8",
      lineSecondary: "#a78bfa",
      bar: "#60a5fa",
      barAlt: "#34d399",
    }),
    [dark]
  );
}
