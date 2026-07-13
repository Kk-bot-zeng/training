import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { success: false, message: "为防止代签，签到页面不再公开学员名单" },
    { status: 410 }
  );
}
