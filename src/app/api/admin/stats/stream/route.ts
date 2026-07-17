export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { collectAdminStats } from "@/lib/admin-stats";

/**
 * GET /api/admin/stats/stream — Server-Sent Events for live dashboard updates.
 * Pushes a snapshot every few seconds while the client stays connected.
 */
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.role !== "admin") {
    return new Response(JSON.stringify({ error: "需要管理员权限" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        if (closed) return;
        try {
          const payload = await collectAdminStats();
          controller.enqueue(
            encoder.encode(`event: stats\ndata: ${JSON.stringify(payload)}\n\n`)
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "stats error";
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`)
          );
        }
      };

      await send();
      const interval = setInterval(() => {
        void send();
      }, 5000);

      const heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
