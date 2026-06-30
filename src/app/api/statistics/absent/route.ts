import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const trainingId = request.nextUrl.searchParams.get("trainingId");
    if (!trainingId) {
      return NextResponse.json(
        { success: false, message: "缺少培训ID" },
        { status: 400 }
      );
    }

    const records = await prisma.attendance.findMany({
      where: {
        trainingId: parseInt(trainingId),
        status: "absent",
      },
      include: {
        employee: { include: { department: true } },
      },
      orderBy: { employee: { name: "asc" } },
    });

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    console.error("Absent stats error:", error);
    return NextResponse.json(
      { success: false, message: "获取缺勤名单失败" },
      { status: 500 }
    );
  }
}
