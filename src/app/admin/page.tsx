import { AdminShell } from "@/components/layout/AdminShell";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";

/**
 * Admin dashboard route (Server Component shell).
 * Heavy interactivity / SSE / charts live in the client subtree.
 */
export default function AdminDashboardPage() {
  return (
    <AdminShell title="仪表盘">
      <AdminDashboardClient />
    </AdminShell>
  );
}
