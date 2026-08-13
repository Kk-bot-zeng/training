import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("next") || "/";
  const safePath = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "") || "http";
  const target = new URL(safePath, `${protocol}://${host}`);
  target.searchParams.set("_fresh", String(Date.now()));
  const response = NextResponse.redirect(target);
  response.headers.set("Clear-Site-Data", '"cache"');
  response.headers.set("Cache-Control", "no-store");
  return response;
}
