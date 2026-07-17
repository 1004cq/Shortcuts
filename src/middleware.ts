import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Edge middleware — protect dashboard / admin routes at the edge.
 * Fine-grained VIP checks for download/stream happen in API route handlers.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/verify");

  const isProtected =
    pathname === "/" ||
    pathname.startsWith("/files") ||
    pathname === "/pricing" ||
    pathname.startsWith("/pricing/") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/admin");

  if (isProtected && !token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (pathname.startsWith("/admin") && token?.role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

// Protect dashboard / admin HTML routes at the edge.
// API routes (/api/*, /s/*) are not matched — they use session or ?token= auth.
export const config = {
  matcher: [
    "/",
    "/files/:path*",
    "/pricing",
    "/pricing/:path*",
    "/profile",
    "/admin/:path*",
    "/login",
    "/register",
    "/verify",
  ],
};
