"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  Menu,
  Search,
  Upload,
  LayoutGrid,
  List,
  Moon,
  Sun,
  LogOut,
  User,
  Crown,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "./SidebarContext";
import { UploadDialog } from "@/components/files/UploadDialog";
import { canUpload, membershipLabel, roleLabel } from "@/lib/permissions";
import type { SessionUser } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TopbarProps = {
  viewMode?: "list" | "grid";
  onViewModeChange?: (mode: "list" | "grid") => void;
  showSearch?: boolean;
  showUpload?: boolean;
  title?: string;
};

export function Topbar({
  viewMode = "list",
  onViewModeChange,
  showSearch = true,
  showUpload = true,
  title,
}: TopbarProps) {
  const { setMobileOpen } = useSidebar();
  const { data } = useSession();
  const user = data?.user as SessionUser | undefined;
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = React.useState("");
  const [uploadOpen, setUploadOpen] = React.useState(false);

  // Avoid useSearchParams so AppShell pages don't require Suspense bailouts
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") || "");
  }, [pathname]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    else params.delete("q");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const initials = (user?.name || user?.email || "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="打开菜单"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {title ? (
          <h1 className="hidden font-display text-lg font-semibold md:block">{title}</h1>
        ) : null}

        {showSearch && (
          <form onSubmit={onSearch} className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索文件、标签..."
              className="h-10 border-border/80 bg-muted/40 pl-9"
            />
          </form>
        )}

        <div className="ml-auto flex items-center gap-2">
          {onViewModeChange && (
            <div className="hidden items-center rounded-lg border border-border p-0.5 sm:flex">
              <button
                type="button"
                onClick={() => onViewModeChange("list")}
                className={cn(
                  "rounded-md p-2 transition",
                  viewMode === "list" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="列表视图"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("grid")}
                className={cn(
                  "rounded-md p-2 transition",
                  viewMode === "grid" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="网格视图"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          )}

          {showUpload && canUpload(user) && (
            <Button size="sm" onClick={() => setUploadOpen(true)} className="hidden sm:inline-flex">
              <Upload className="h-4 w-4" />
              上传
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="切换主题"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarFallback className="bg-primary/20 text-sm font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <div className="mt-1 flex gap-1">
                    <Badge variant="secondary">{roleLabel(user?.role || "user")}</Badge>
                    <Badge variant={user?.membership === "free" ? "outline" : "vip"}>
                      {membershipLabel(user?.membership || "free")}
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <User className="h-4 w-4" />
                  个人中心
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/pricing">
                  <Crown className="h-4 w-4" />
                  升级会员
                </Link>
              </DropdownMenuItem>
              {canUpload(user) && (
                <DropdownMenuItem asChild>
                  <Link href="/admin">
                    <Shield className="h-4 w-4" />
                    管理后台
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => router.refresh()}
      />
    </>
  );
}
