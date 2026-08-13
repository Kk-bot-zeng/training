import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = JSON.stringify({
      message: String(body?.message || "unknown").slice(0, 500),
      stack: String(body?.stack || "").slice(0, 3000),
      digest: String(body?.digest || "").slice(0, 200),
      url: String(body?.url || "").slice(0, 1000),
      userAgent: request.headers.get("user-agent")?.slice(0, 500),
    });
    console.error("Client runtime error:", text);
  } catch (error) {
    console.error("Client error report parse failed:", error);
  }
  return NextResponse.json({ success: true });
}
