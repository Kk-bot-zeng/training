import { NextRequest, NextResponse } from "next/server";
import { assertCheckinOpen, createScanSession, getCheckinWindow, resolveDynamicQrToken, scanCookie } from "@/lib/checkin";

const errorMessages: Record<string, string> = {
  QR_EXPIRED: "二维码已更新，请重新扫描现场二维码",
  TRAINING_ENDED: "培训已结束，无法签到",
  CHECKIN_NOT_OPEN: "签到尚未开始，请在培训开始前15分钟扫码",
  CHECKIN_CLOSED: "本次签到已截止，请联系管理员补签",
};

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("qrToken");
    if (!token) return NextResponse.json({ success: false, message: "参数错误" }, { status: 400 });
    const training = await resolveDynamicQrToken(token);
    assertCheckinOpen(training);
    const window = getCheckinWindow(training);
    const response = NextResponse.json({
      success: true,
      data: {
        id: training.id, title: training.title, type: training.type, date: training.date,
        startTime: training.startTime, endTime: training.endTime, location: training.location,
        status: training.status, checkinClosesAt: window.closesAt,
      },
    });
    const scanToken = await createScanSession(training.id, training.qrToken);
    response.cookies.set(scanCookie.name, scanToken, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      maxAge: scanCookie.maxAge, path: "/",
    });
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ success: false, message: errorMessages[code] || "签到二维码无效" }, { status: 400 });
  }
}
