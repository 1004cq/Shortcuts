"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutGrid,
  Film,
  Music,
  FileText,
  Image as ImageIcon,
  Crown,
  Settings,
  Users,
  BarChart3,
  HardDrive,
  ChevronLeft,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";
import { useSession } from "next-auth/react";
import { canManageUsers } from "@/lib/permissions";
import type { SessionUser } from "@/types";
import { Suspense } from "react";

const mainNav = [
  { href: "/", label: "全部文件", icon: LayoutGrid, category: null as string | null },
  { href: "/?category=video", label: "视频", icon: Film, category: "video" },
  { href: "/?category=audio", label: "音频", icon: Music, category: "audio" },
  { href: "/?category=document", label: "文档", icon: FileText, category: "document" },
  { href: "/?category=image", label: "图片", icon: ImageIcon, category: "image" },
  { href: "/pricing", label: "会员套餐", icon: Crown, category: null },
];

const adminNav = [
  { href: "/admin", label: "仪表盘", icon: BarChart3 },
  { href: "/admin/files", label: "文件管理", icon: HardDrive },
  { href: "/admin/users", label: "用户管理", icon: Users },
  { href: "/admin/downloads", label: "下载统计", icon: Shield },
  { href: "/admin/settings", label: "系统设置", icon: Settings },
];

function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category");
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebar();
  const { data } = useSession();
  const user = data?.user as SessionUser | undefined;
  const showAdmin = canManageUsers(user);

  const content = (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-sidebar/80 backdrop-blur-xl transition-all duration-300",
        collapsed ? "w-[72px]" : "w-60"
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-border px-4", collapsed && "justify-center px-2")}>
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden" onClick={() => setMobileOpen(false)}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <HardDrive className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0 animate-in fade-in slide-in-from-left-2 duration-300">
              <p className="truncate font-display text-lg font-bold tracking-tight text-foreground">
                MediaVault
              </p>
              <p className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                Secure Media Hub
              </p>
            </div>
          )}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {!collapsed && (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            浏览
          </p>
        )}
        {mainNav.map(({ href, label, icon: Icon, category }) => {
          const highlighted =
            href === "/pricing"
              ? pathname.startsWith("/pricing")
              : pathname === "/" &&
                (category ? currentCategory === category : !currentCategory);

          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                highlighted
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}

        {showAdmin && (
          <>
            {!collapsed && (
              <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                管理
              </p>
            )}
            {collapsed && <div className="my-3 border-t border-border" />}
            {adminNav.map(({ href, label, icon: Icon }) => {
              const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? label : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground md:flex",
            collapsed && "justify-center px-2"
          )}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && <span>收起侧栏</span>}
        </button>
        {!collapsed && (
          <Link
            href="/profile"
            onClick={() => setMobileOpen(false)}
            className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          >
            <Settings className="h-4 w-4" />
            设置
          </Link>
        )}
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden md:sticky md:top-0 md:flex md:h-screen md:shrink-0">{content}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close sidebar"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-60 animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
}

export function Sidebar() {
  return (
    <Suspense fallback={<div className="hidden w-60 shrink-0 border-r border-border md:block" />}>
      <SidebarNav />
    </Suspense>
  );
}
