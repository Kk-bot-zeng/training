import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const totalEmployees = await prisma.employee.count({
      where: { status: "active" },
    });
    const activeDepartments = await prisma.department.count();

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const totalTrainingsThisMonth = await prisma.training.count({
      where: { date: { gte: firstOfMonth } },
    });

    // Average attendance rate across completed trainings
    const completedTrainings = await prisma.training.findMany({
      where: { status: "completed" },
      include: { attendance: true },
      orderBy: { date: "desc" },
      take: 10,
    });

    let avgAttendanceRate = 0;
    if (completedTrainings.length > 0) {
      const rates = completedTrainings.map((t) => {
        const total = t.attendance.length;
        if (total === 0) return 100;
        const attended = t.attendance.filter((a) =>
          ["present", "late"].includes(a.status)
        ).length;
        return (attended / total) * 100;
      });
      avgAttendanceRate =
        rates.reduce((sum, r) => sum + r, 0) / rates.length;
    }

    const recentTrainings = completedTrainings.slice(0, 5).map((t) => {
      const total = t.attendance.length;
      const attended = t.attendance.filter((a) =>
        ["present", "late"].includes(a.status)
      ).length;
      return {
        id: t.id,
        title: t.title,
        date: t.date.toISOString(),
        rate: total > 0 ? Math.round((attended / total) * 100) : 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        totalEmployees,
        totalTrainingsThisMonth,
        avgAttendanceRate: Math.round(avgAttendanceRate * 10) / 10,
        activeDepartments,
        recentTrainings,
      },
    });
  } catch (error) {
    console.error("Overview stats error:", error);
    return NextResponse.json(
      { success: false, message: "获取统计数据失败" },
      { status: 500 }
    );
  }
}
