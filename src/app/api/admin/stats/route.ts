export const dynamic = "force-dynamic";

import { collectAdminStats } from "@/lib/admin-stats";
import { jsonOk, requireAdmin, withApiHandler } from "@/lib/api";

/** GET /api/admin/stats — dashboard KPIs + chart series */
export const GET = withApiHandler(async () => {
  await requireAdmin();
  const payload = await collectAdminStats();
  return jsonOk(payload);
});
