import { create } from "zustand";
import type { AdminStatsPayload } from "@/lib/admin-stats";

type AdminDashboardState = {
  data: AdminStatsPayload | null;
  loading: boolean;
  error: string;
  live: boolean;
  lastUpdated: string | null;
  sidebarCollapsed: boolean;
  setLoading: (v: boolean) => void;
  setError: (v: string) => void;
  setData: (data: AdminStatsPayload) => void;
  setLive: (v: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
};

export const useAdminDashboardStore = create<AdminDashboardState>((set) => ({
  data: null,
  loading: true,
  error: "",
  live: false,
  lastUpdated: null,
  sidebarCollapsed: false,
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setData: (data) =>
    set({
      data,
      loading: false,
      error: "",
      lastUpdated: data.updatedAt,
    }),
  setLive: (live) => set({ live }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
}));
