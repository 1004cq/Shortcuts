export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { buildPublicShortUrl } from "@/lib/shortlink";

type Ctx = { params: { userId: string } };

/** Legacy /apl/:userId → permanent redirect to /api/:userId */
export async function GET(_req: Request, ctx: Ctx) {
  const { userId } = ctx.params;
  return NextResponse.redirect(buildPublicShortUrl(userId), 301);
}
