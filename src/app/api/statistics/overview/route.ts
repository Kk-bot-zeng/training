import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await getAuthAdmin();

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [totalEmployees, activeDepartments, totalTrainingsThisMonth, completedTrainings, departmentStats] = await Promise.all([
      prisma.employee.count({ where: { status: "active" } }),
      prisma.department.count(),
      prisma.training.count({ where: { date: { gte: firstOfMonth } } }),
      prisma.training.findMany({
        where: { status: "completed" },
        select: {
          id: true, title: true, date: true,
          attendance: { select: { status: true } },
        },
        orderBy: { date: "desc" },
        take: 10,
      }),
      prisma.$queryRaw<{ name: string; total: number; attended: number }[]>(Prisma.sql`
        SELECT d."name", COUNT(a."id") FILTER (WHERE a."status" <> 'leave')::int AS "total",
          COUNT(a."id") FILTER (WHERE a."status" IN ('present', 'late'))::int AS "attended"
        FROM "Attendance" a
        INNER JOIN "Employee" e ON e."id" = a."employeeId"
        INNER JOIN "Department" d ON d."id" = e."departmentId"
        GROUP BY d."id", d."name"
      `),
    ]);

    let avgAttendanceRate = 0;
    if (completedTrainings.length > 0) {
      const rates = completedTrainings.map((t) => {
        const total = t.attendance.filter((a) => a.status !== "leave").length;
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
      const total = t.attendance.filter((a) => a.status !== "leave").length;
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
        departments: departmentStats
          .map((department) => ({
            name: department.name,
            total: department.total,
            rate: department.total > 0
              ? `${((department.attended / department.total) * 100).toFixed(1)}%`
              : "0.0%",
          }))
          .sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate)),
      },
    }, { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=45" } });
  } catch (error) {
    console.error("Overview stats error:", error);
    return NextResponse.json(
      { success: false, message: "获取统计数据失败" },
      { status: 500 }
    );
  }
}
