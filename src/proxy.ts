import { NextRequest, NextResponse } from "next/server";

const publicPaths = [
  "/login",
  "/checkin",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/checkin",
];

// Don't verify JWT in proxy — just check presence of token cookie.
// Actual JWT verification is done in API route handlers via getAuthUser/getAuthAdmin.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // Protect pages & API routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/portal") || pathname.startsWith("/api/")) {
    const token = request.cookies.get("token")?.value;

    if (!token) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
    // Token exists — let the route handler verify it
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/api/:path*"],
};
