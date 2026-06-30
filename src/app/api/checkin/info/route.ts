import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const qrToken = request.nextUrl.searchParams.get("qrToken");
    if (!qrToken) {
      return NextResponse.json(
        { success: false, message: "参数错误" },
        { status: 400 }
      );
    }

    const training = await prisma.training.findUnique({
      where: { qrToken },
      select: {
        id: true,
        title: true,
        type: true,
        date: true,
        startTime: true,
        endTime: true,
        location: true,
        status: true,
      },
    });

    if (!training) {
      return NextResponse.json(
        { success: false, message: "培训不存在" },
        { status: 404 }
      );
    }

    if (training.status === "completed") {
      return NextResponse.json(
        { success: false, message: "培训已结束，无法签到" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: training });
  } catch (error) {
    console.error("Get checkin info error:", error);
    return NextResponse.json(
      { success: false, message: "获取培训信息失败" },
      { status: 500 }
    );
  }
}
