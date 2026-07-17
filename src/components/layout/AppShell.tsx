"use client";

import { Suspense } from "react";
import { SidebarProvider } from "./SidebarContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MainContent } from "./MainContent";
import { MobileTabBar } from "./MobileTabBar";

type AppShellProps = {
  children: React.ReactNode;
  viewMode?: "list" | "grid";
  onViewModeChange?: (mode: "list" | "grid") => void;
  showSearch?: boolean;
  showUpload?: boolean;
  title?: string;
  /** Hide mobile tab bar (e.g. immersive player) */
  hideMobileTabBar?: boolean;
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
}: AppShellProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Suspense fallback={<div className="h-16 border-b border-border" />}>
            <Topbar
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
              showSearch={showSearch}
              showUpload={showUpload}
              title={title}
            />
          </Suspense>
          <MainContent>{children}</MainContent>
        </div>
        {!hideMobileTabBar && <MobileTabBar />}
      </div>
    </SidebarProvider>
  );
}
