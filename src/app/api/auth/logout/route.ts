import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true, message: "已退出" });
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.hostname;
  const secureSetting = process.env.AUTH_COOKIE_SECURE;
  const secureCookie = secureSetting === "true"
    || (secureSetting !== "false" && (
      forwardedProto === "https"
      || request.nextUrl.protocol === "https:"
      || host.split(":")[0] === "training.kkzlqnb.top"
    ));
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
