import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const trainingWhere: Record<string, unknown> = {};
    if (startDate) trainingWhere.date = { gte: new Date(startDate) };
    if (endDate) {
      trainingWhere.date = {
        ...(trainingWhere.date as object),
        lte: new Date(endDate),
      };
    }

    const trainings = await prisma.training.findMany({
      where: trainingWhere,
      include: {
        attendance: {
          include: { employee: { select: { departmentId: true } } },
        },
      },
    });

    // Aggregate by department
    const deptStats: Record<
      number,
      { name: string; total: number; attended: number }
    > = {};

    const allDepts = await prisma.department.findMany();
    for (const dept of allDepts) {
      deptStats[dept.id] = { name: dept.name, total: 0, attended: 0 };
    }

    for (const training of trainings) {
      for (const record of training.attendance) {
        const deptId = record.employee.departmentId;
        if (deptStats[deptId]) {
          deptStats[deptId].total++;
          if (["present", "late"].includes(record.status)) {
            deptStats[deptId].attended++;
          }
        }
      }
    }

    const result = Object.values(deptStats)
      .filter((d) => d.total > 0)
      .map((d) => ({
        ...d,
        rate: ((d.attended / d.total) * 100).toFixed(1) + "%",
      }))
      .sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate));

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Department stats error:", error);
    return NextResponse.json(
      { success: false, message: "获取部门统计失败" },
      { status: 500 }
    );
  }
}
