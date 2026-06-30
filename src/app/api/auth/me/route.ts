import { NextResponse } from "next/server";
import { getAuthAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const admin = await getAuthAdmin();
    return NextResponse.json({ success: true, data: admin });
  } catch {
    return NextResponse.json(
      { success: false, message: "未登录" },
      { status: 401 }
    );
  }
}
