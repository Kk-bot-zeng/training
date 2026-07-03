import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "training-attendance-secret-key"
);

const publicPaths = [
  "/login",
  "/checkin",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/checkin",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/auth/login")
  ) {
    return NextResponse.next();
  }

  // Protect admin pages and API routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/")) {
    const token =
      request.cookies.get("token")?.value ||
      request.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, message: "未登录" },
          { status: 401 }
        );
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      await jwtVerify(token, JWT_SECRET);
      return NextResponse.next();
    } catch {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, message: "登录已过期" },
          { status: 401 }
        );
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/api/:path*"],
};
