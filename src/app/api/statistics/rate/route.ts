import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await getAuthAdmin();
    const trainingId = request.nextUrl.searchParams.get("trainingId");
    if (!trainingId) {
      return NextResponse.json(
        { success: false, message: "缺少培训ID" },
        { status: 400 }
      );
    }

    const training = await prisma.training.findUnique({
      where: { id: parseInt(trainingId) },
      include: { attendance: true },
    });

    if (!training) {
      return NextResponse.json(
        { success: false, message: "培训不存在" },
        { status: 404 }
      );
    }

    const total = training.attendance.length;
    const present = training.attendance.filter((a) => a.status === "present").length;
    const late = training.attendance.filter((a) => a.status === "late").length;
    const leave = training.attendance.filter((a) => a.status === "leave").length;
    const absent = training.attendance.filter((a) => a.status === "absent").length;

    const presentRate = total > 0 ? ((present + late) / total * 100).toFixed(1) : "0.0";
    const absentRate = total > 0 ? (absent / total * 100).toFixed(1) : "0.0";

    return NextResponse.json({
      success: true,
      data: {
        trainingTitle: training.title,
        total,
        present,
        late,
        leave,
        absent,
        presentRate: `${presentRate}%`,
        absentRate: `${absentRate}%`,
      },
    });
  } catch (error) {
    console.error("Rate stats error:", error);
    return NextResponse.json(
      { success: false, message: "获取出勤率失败" },
      { status: 500 }
    );
  }
}
