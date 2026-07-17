import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground", className)}>
      <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground">
        <Home className="h-3.5 w-3.5" />
        首页
      </Link>
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
