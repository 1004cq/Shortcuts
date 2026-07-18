"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Crown, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { canManageUsers } from "@/lib/permissions";
import type { SessionUser } from "@/types";

const tabs = [
  { href: "/", label: "文件", icon: LayoutGrid },
  { href: "/pricing", label: "会员", icon: Crown },
  { href: "/profile", label: "我的", icon: User },
];

/**
 * Mobile bottom tab bar — replaces collapsed sidebar on small screens.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const { data } = useSession();
  const user = data?.user as SessionUser | undefined;
  const items = canManageUsers(user)
    ? [...tabs, { href: "/admin", label: "管理", icon: Shield }]
    : tabs;

  return (
    <nav
      data-mobile-tabbar
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl transition-transform duration-200 md:hidden supports-[backdrop-filter]:bg-background/85"
    >
      <ul className="flex h-14 items-stretch justify-around">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex h-full min-h-0 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition sm:gap-1 sm:text-[11px]",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl transition sm:h-9 sm:w-9",
                    active && "bg-primary/15"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
