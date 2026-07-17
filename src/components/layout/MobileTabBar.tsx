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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <ul className="flex h-16 items-stretch justify-around">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_8px_rgba(59,130,246,0.55)]")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
