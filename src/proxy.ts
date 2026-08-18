import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/session";

const publicPaths = [
  "/login",
  "/checkin",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/checkin",
  "/api/recover",
  "/api/client-errors",
];

function clearInvalidSession(response: NextResponse) {
  response.cookies.set("token", "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    const response = NextResponse.next();
    if (pathname === "/login") {
      response.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, max-age=0",
      );
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");
    }
    return response;
  }

  // Allow static assets
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // Protect pages & API routes
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/api/")
  ) {
    const token = request.cookies.get("token")?.value;

    if (!token) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, message: "未登录" },
          { status: 401 },
        );
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }
    try {
      const session = await verifySessionToken(token);

      if (pathname.startsWith("/admin") && session.role !== "admin") {
        return NextResponse.redirect(new URL("/portal", request.url));
      }
      if (pathname.startsWith("/portal") && session.role !== "employee") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }

      // Route handlers still enforce their own fine-grained authorization.
      return NextResponse.next();
    } catch {
      if (pathname.startsWith("/api/")) {
        return clearInvalidSession(NextResponse.json(
          { success: false, message: "登录已失效，请重新登录" },
          { status: 401 },
        ));
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return clearInvalidSession(NextResponse.redirect(loginUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/api/:path*"],
};
