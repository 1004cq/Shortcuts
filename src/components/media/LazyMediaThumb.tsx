"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type LazyMediaThumbProps = {
  /** When null/empty, only the fallback / placeholder is shown (no network). */
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  /** Shown before load and on error (e.g. type icon). */
  fallback?: React.ReactNode;
  /** How far before viewport to start loading (IO rootMargin). */
  rootMargin?: string;
  /** Eagerly load (e.g. selected preview panel). Still fades in smoothly. */
  priority?: boolean;
};

type LoadStatus = "idle" | "loading" | "loaded" | "error";

/**
 * Viewport-aware lazy image:
 * - Intersection Observer gates setting `src` until near viewport
 * - Native `loading="lazy"` + `decoding="async"` as a second layer
 * - Grey pulse placeholder → opacity fade-in; error → fallback icon
 */
export function LazyMediaThumb({
  src,
  alt,
  className,
  imgClassName,
  fallback,
  rootMargin = "240px 0px",
  priority = false,
}: LazyMediaThumbProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [inView, setInView] = React.useState(priority);
  const [status, setStatus] = React.useState<LoadStatus>(
    src && priority ? "loading" : "idle"
  );

  React.useEffect(() => {
    setStatus(src && priority ? "loading" : src ? "idle" : "error");
    if (priority) setInView(true);
    else setInView(false);
  }, [src, priority]);

  React.useEffect(() => {
    if (priority || !src) return;
    const el = rootRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      setStatus("loading");
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            setStatus((s) => (s === "loaded" || s === "error" ? s : "loading"));
            io.disconnect();
            break;
          }
        }
      },
      { root: null, rootMargin, threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src, priority, rootMargin]);

  const showImg = Boolean(src) && inView && status !== "error";
  const showFallback = !src || status === "error" || (!inView && !priority);
  const showPlaceholder =
    Boolean(src) && status !== "loaded" && status !== "error";

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative overflow-hidden bg-white/[0.06]",
        className
      )}
    >
      {showPlaceholder && (
        <div
          aria-hidden
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/10 via-white/5 to-transparent"
        />
      )}

      {showFallback && (
        <div
          className={cn(
            "absolute inset-0 z-[1] flex items-center justify-center text-slate-300",
            status === "loaded" && "hidden"
          )}
        >
          {fallback}
        </div>
      )}

      {showImg && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          className={cn(
            "relative z-[2] h-full w-full object-cover transition-opacity duration-300 ease-out",
            status === "loaded" ? "opacity-100" : "opacity-0",
            imgClassName
          )}
        />
      )}
    </div>
  );
}
