export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/utils";

type Ctx = { params: { id: string } };

/**
 * Short link for Apple Shortcuts:
 *   /s/{fileId}?token=mv_xxx  →  /api/files/{fileId}/download?token=...
 *
 * Prefer NEXTAUTH_URL / Host header — never use 0.0.0.0 from HOSTNAME.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const token = req.nextUrl.searchParams.get("token") || "";

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "";
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host.includes("localhost") ? "http" : "http");

  const base =
    (process.env.NEXTAUTH_URL || process.env.APP_URL || "").replace(/\/$/, "") ||
    (host ? `${proto}://${host}` : getAppUrl().replace(/\/$/, ""));

  const target = new URL(`${base}/api/files/${id}/download`);
  if (token) target.searchParams.set("token", token);

  return NextResponse.redirect(target.toString(), 307);
}
