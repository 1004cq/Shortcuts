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

  const isAdminLogin = pathname === "/admin/login";
  /** Public iPhone receiver page nested under /admin (no login) */
  const isAdminReceiver = pathname === "/admin/rx";
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminProtected = isAdminArea && !isAdminLogin && !isAdminReceiver;

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/verify");

  const isProtected =
    pathname === "/" ||
    pathname.startsWith("/files") ||
    pathname === "/pricing" ||
    pathname.startsWith("/pricing/") ||
    pathname === "/recharge" ||
    pathname.startsWith("/recharge/") ||
    pathname.startsWith("/profile");

  // Admin console: keep auth under /admin/login
  if (isAdminProtected && !token) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminProtected && token?.role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (isAdminLogin && token?.role === "admin") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  if (isAdminLogin && token && token.role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (isProtected && !token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && token) {
    // Admins land in the admin console by default
    const dest = token.role === "admin" ? "/admin" : "/";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  return NextResponse.next();
}

// Protect dashboard / admin HTML routes at the edge.
// Public short links (/api/*, legacy /apl/*) and token routes are not matched.
export const config = {
  matcher: [
    "/",
    "/files/:path*",
    "/pricing",
    "/pricing/:path*",
    "/recharge",
    "/recharge/:path*",
    "/profile",
    "/admin",
    "/admin/:path*",
    "/login",
    "/register",
    "/verify",
  ],
};
