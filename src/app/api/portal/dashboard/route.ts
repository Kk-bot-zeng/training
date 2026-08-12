import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (user.role !== "employee") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const [employee, records, attendanceCounts, papers] = await Promise.all([
      prisma.employee.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          employeeNo: true,
          department: { select: { name: true } },
        },
      }),
      prisma.attendance.findMany({
        where: { employeeId: user.id },
        select: {
          id: true,
          status: true,
          checkInTime: true,
          training: { select: { id: true, title: true, type: true, date: true } },
        },
        orderBy: { training: { date: "desc" } },
        take: 10,
      }),
      prisma.attendance.groupBy({
        by: ["status"],
        where: { employeeId: user.id },
        _count: { _all: true },
      }),
      prisma.examPaper.findMany({
        where: { status: "published" },
        include: {
          attempts: { where: { employeeId: user.id }, select: { status: true } },
          _count: { select: { paperQuestions: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!employee) {
      return NextResponse.json({ success: false, message: "Employee not found" }, { status: 404 });
    }

    const countByStatus = new Map(attendanceCounts.map((item) => [item.status, item._count._all]));
    const attended = (countByStatus.get("present") || 0) + (countByStatus.get("late") || 0);
    const total = attendanceCounts.reduce((sum, item) => sum + item._count._all, 0);
    const leave = countByStatus.get("leave") || 0;
    const absent = countByStatus.get("absent") || 0;
    const effectiveTotal = total - leave;
    const publishedPapers = papers.map(({ attempts, ...paper }) => {
      const completedAttempts = attempts.filter((attempt) => attempt.status === "submitted").length;
      return {
        ...paper,
        completedAttempts,
        canAttempt: paper.allowRetake || completedAttempts === 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        papers: publishedPapers,
        stats: {
          employee: {
            id: employee.id,
            name: employee.name,
            employeeNo: employee.employeeNo,
            department: employee.department.name,
          },
          records,
          summary: {
            total,
            attended,
            effectiveTotal,
            leave,
            absent,
            rate: effectiveTotal > 0 ? `${((attended / effectiveTotal) * 100).toFixed(1)}%` : "N/A",
          },
        },
      },
    }, { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=45" } });
  } catch (error) {
    console.error("Portal dashboard error:", error);
    return NextResponse.json({ success: false, message: "Failed to load dashboard" }, { status: 500 });
  }
}
