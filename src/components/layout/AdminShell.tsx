"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardDrive, BarChart3, Users, Shield, FolderOpen, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const adminLinks = [
  { href: "/admin", label: "仪表盘", icon: BarChart3 },
  { href: "/admin/files", label: "文件管理", icon: FolderOpen },
  { href: "/admin/users", label: "用户管理", icon: Users },
  { href: "/admin/downloads", label: "下载统计", icon: Shield },
];

/**
 * Independent dark admin shell — wider left menu + dashboard content.
 */
export function AdminShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#0b1220] text-slate-100">
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
                {label}
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
        <header className="flex h-16 items-center border-b border-slate-800 bg-[#0b1220]/90 px-4 backdrop-blur md:px-8">
          <h1 className="font-display text-lg font-semibold">{title || "管理后台"}</h1>
          <div className="ml-auto flex gap-2 md:hidden">
            {adminLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-md px-2 py-1 text-xs",
                  pathname === href ? "bg-primary/20 text-primary" : "text-slate-400"
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
