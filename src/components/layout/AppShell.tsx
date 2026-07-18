"use client";

import { Suspense } from "react";
import { SidebarProvider } from "./SidebarContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MainContent } from "./MainContent";
import { MobileTabBar } from "./MobileTabBar";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  viewMode?: "list" | "grid";
  onViewModeChange?: (mode: "list" | "grid") => void;
  showSearch?: boolean;
  showUpload?: boolean;
  title?: string;
  hideMobileTabBar?: boolean;
  contentClassName?: string;
};

/**
 * Global app chrome: Sidebar + Topbar + MainContent (+ mobile TabBar).
 */
export function AppShell({
  children,
  viewMode,
  onViewModeChange,
  showSearch = true,
  showUpload = true,
  title,
  hideMobileTabBar = false,
  contentClassName,
}: AppShellProps) {
  return (
    <SidebarProvider>
      <div className="flex h-full min-h-0 w-full flex-1 bg-background text-foreground">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Suspense fallback={<div className="h-14 shrink-0 border-b border-border sm:h-16" />}>
            <Topbar
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
              showSearch={showSearch}
              showUpload={showUpload}
              title={title}
            />
          </Suspense>
          <MainContent
            className={cn(hideMobileTabBar && "pb-6 md:pb-8", contentClassName)}
            withTabPad={!hideMobileTabBar}
          >
            {children}
          </MainContent>
        </div>
        {!hideMobileTabBar && <MobileTabBar />}
      </div>
    </SidebarProvider>
  );
}
