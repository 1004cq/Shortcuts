export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

type Ctx = { params: { id: string } };

/**
 * Short link for Apple Shortcuts:
 *   /s/{fileId}?token=mv_xxx  →  /api/files/{fileId}/download?token=...
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const token = req.nextUrl.searchParams.get("token") || "";
  const target = new URL(`/api/files/${id}/download`, req.nextUrl.origin);
  if (token) target.searchParams.set("token", token);
  redirect(target.toString());
}
