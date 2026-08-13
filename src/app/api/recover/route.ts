import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("next") || "/";
  const safePath = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  const target = new URL(safePath, request.nextUrl.origin);
  target.searchParams.set("_fresh", String(Date.now()));
  const response = NextResponse.redirect(target);
  response.headers.set("Clear-Site-Data", '"cache"');
  response.headers.set("Cache-Control", "no-store");
  return response;
}
