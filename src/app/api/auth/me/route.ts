import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    return NextResponse.json({ success: true, data: user }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { success: false, message: "未登录" },
      { status: 401 }
    );
  }
}
