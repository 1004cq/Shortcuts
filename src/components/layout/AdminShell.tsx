"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardDrive, BarChart3, Users, Shield, FolderOpen, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const adminLinks = [
  { href: "/admin", label: "仪表盘", icon: BarChart3 },
  { href: "/admin/files", label: "文件", icon: FolderOpen },
  { href: "/admin/users", label: "用户", icon: Users },
  { href: "/admin/downloads", label: "下载", icon: Shield },
];

/**
 * Independent dark admin shell — wider left menu + dashboard content.
 */
export function AdminShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-[100dvh] bg-[#0b1220] text-slate-100">
      <aside className="hidden w-64 shrink-0 border-r border-slate-800 bg-[#0a101c] md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
            <HardDrive className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-base font-bold">MediaVault</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Admin Console</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {adminLinks.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-primary/20 text-primary"
                    : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-100"
                )}
              >
                <Icon className="h-4 w-4" />
                {label === "文件" ? "文件管理" : label === "用户" ? "用户管理" : label === "下载" ? "下载统计" : label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-800 p-4">
          <Button asChild variant="ghost" className="w-full justify-start text-slate-400 hover:text-white">
            <Link href="/">
              <ChevronLeft className="h-4 w-4" />
              返回前台
            </Link>
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-800 bg-[#0b1220]/95 px-3 backdrop-blur sm:h-16 sm:px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <HardDrive className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold">MediaVault</p>
              <p className="truncate text-[10px] text-slate-500">{title || "管理后台"}</p>
            </div>
          </div>
          <h1 className="hidden font-display text-lg font-semibold md:block">{title || "管理后台"}</h1>
          <Button asChild variant="ghost" size="sm" className="ml-auto text-slate-400 hover:text-white md:hidden">
            <Link href="/">
              <ChevronLeft className="h-4 w-4" />
              前台
            </Link>
          </Button>
        </header>

        {/* Mobile admin tabs */}
        <nav className="sticky top-14 z-10 border-b border-slate-800 bg-[#0b1220]/95 backdrop-blur md:hidden">
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
                      ? "border-primary text-primary"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        <main className="flex-1 overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
