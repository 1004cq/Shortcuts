"use client";

import * as React from "react";

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * iOS / mobile viewport helpers:
 * - sync --vvh with visualViewport (address bar show/hide)
 * - mark html when keyboard likely open (viewport shrink)
 * - soft overscroll containment without blocking nested scroll
 */
export function ViewportGuard() {
  React.useEffect(() => {
    const root = document.documentElement;

    const syncViewport = () => {
      const vv = window.visualViewport;
      const height = vv?.height ?? window.innerHeight;
      root.style.setProperty("--vvh", `${height * 0.01}px`);
      root.style.setProperty("--app-height", `${height}px`);

      // Rough keyboard detection on iOS Safari / WKWebView
      const full = window.innerHeight;
      const shrunk = height < full * 0.75;
      root.classList.toggle("vv-keyboard", shrunk);
    };

    const onResize = debounce(syncViewport, 50);
    syncViewport();

    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);

    // Prevent pull-to-refresh bounce on non-scrollable chrome (body)
    // while allowing scroll inside [data-scroll-root]
    let startY = 0;
    let startX = 0;
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? 0;
      startX = e.touches[0]?.clientX ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const touch = e.touches[0];
      if (!touch) return;
      const deltaY = touch.clientY - startY;
      const deltaX = touch.clientX - startX;
      // Prefer horizontal carousels / chip rows
      if (Math.abs(deltaX) > Math.abs(deltaY)) return;

      const scroller = target.closest("[data-scroll-root]") as HTMLElement | null;
      if (!scroller) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = scroller;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
      if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
        if (e.cancelable) e.preventDefault();
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onResize);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return null;
}
