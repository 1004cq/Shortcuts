"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  HardDrive,
  BarChart3,
  Users,
  Shield,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAdminDashboardStore } from "@/store/admin-dashboard";

const adminLinks = [
  { href: "/admin", label: "仪表盘", icon: BarChart3 },
  { href: "/admin/files", label: "文件管理", icon: FolderOpen },
  { href: "/admin/users", label: "用户管理", icon: Users },
  { href: "/admin/downloads", label: "下载统计", icon: Shield },
  { href: "/admin/remote-play", label: "远程音频", icon: Radio },
  { href: "/admin/settings", label: "系统设置", icon: Settings },
];/**
 * Glassmorphic admin shell — collapsible sidebar + themed header.
 */
export function AdminShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const { sidebarCollapsed, toggleSidebar } = useAdminDashboardStore();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const dark = !mounted || resolvedTheme !== "light";

  return (
    <div
      className={cn(
        "admin-aurora relative flex h-full min-h-0 w-full flex-1 text-foreground",
        dark ? "dark bg-[#070b14]" : "bg-[#eef2f8]"
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora-blob aurora-blob-a" />
        <div className="aurora-blob aurora-blob-b" />
        <div className="aurora-blob aurora-blob-c" />
      </div>

      <aside
        className={cn(
          "relative z-20 hidden shrink-0 flex-col border-r border-white/10 liquid-glass-sidebar transition-[width] duration-300 md:flex",
          sidebarCollapsed ? "w-[78px]" : "w-64"
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-white/10 px-4",
            sidebarCollapsed ? "justify-center" : "gap-2 px-5"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 text-white shadow-lg shadow-sky-500/30">
            <HardDrive className="h-5 w-5" />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="font-display text-base font-bold tracking-tight">MediaVault</p>
              <p className="truncate text-[10px] tracking-wide text-muted-foreground">
                cq.imim.chat/admin
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {adminLinks.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  sidebarCollapsed && "justify-center px-2",
                  active
                    ? "border border-white/15 bg-white/10 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active && "text-sky-300")} />
                {!sidebarCollapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-white/10 p-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className={cn(
              "w-full text-muted-foreground hover:text-foreground",
              sidebarCollapsed ? "justify-center px-0" : "justify-start"
            )}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                折叠侧栏
              </>
            )}
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              "w-full text-muted-foreground hover:text-foreground",
              sidebarCollapsed ? "justify-center px-0" : "justify-start"
            )}
          >
            <Link href="/">
              <ChevronLeft className="h-4 w-4" />
              {!sidebarCollapsed && "返回前台"}
            </Link>
          </Button>
        </div>
      </aside>

      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-white/10 liquid-glass-header px-3 sm:h-16 sm:px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 text-white">
              <HardDrive className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold">MediaVault</p>
              <p className="truncate text-[10px] text-muted-foreground">{title || "管理后台"}</p>
            </div>
          </div>

          <div className="hidden min-w-0 md:block">
            <h1 className="font-display text-lg font-semibold tracking-tight">
              {title || "管理后台"}
            </h1>
            <p className="text-xs text-muted-foreground">彩色液态玻璃 · 实时运营视图</p>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-xl border border-white/10 bg-white/5"
              onClick={() => setTheme(dark ? "light" : "dark")}
              aria-label="切换主题"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden rounded-xl border border-white/10 bg-white/5 md:inline-flex"
              onClick={toggleSidebar}
              aria-label="折叠侧栏"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="rounded-xl border border-white/10 bg-white/5 text-muted-foreground hover:text-foreground md:hidden"
            >
              <Link href="/">前台</Link>
            </Button>
          </div>
        </header>

        <nav className="sticky top-14 z-10 border-b border-white/10 liquid-glass-header md:hidden">
          <div className="flex overflow-x-auto no-scrollbar px-2">
            {adminLinks.map(({ href, label, icon: Icon }) => {
              const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition",
                    active
                      ? "border-sky-400 text-sky-300"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label.replace("管理", "").replace("统计", "")}
                </Link>
              );
            })}
          </div>
        </nav>

        <main
          data-scroll-root
          className="scroll-root min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6 lg:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
