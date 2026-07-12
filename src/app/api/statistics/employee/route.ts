import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    const requestedId = request.nextUrl.searchParams.get("employeeId");
    const employeeId = requestedId || String(user.id);
    if (!employeeId) {
      return NextResponse.json(
        { success: false, message: "缺少员工ID" },
        { status: 400 }
      );
    }

    if (user.role !== "admin" && parseInt(employeeId) !== user.id) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(employeeId) },
      include: { department: true },
    });

    if (!employee) {
      return NextResponse.json(
        { success: false, message: "员工不存在" },
        { status: 404 }
      );
    }

    const records = await prisma.attendance.findMany({
      where: { employeeId: employee.id },
      include: {
        training: { select: { id: true, title: true, type: true, date: true } },
      },
      orderBy: { training: { date: "desc" } },
    });

    const total = records.length;
    const attended = records.filter((r) =>
      ["present", "late"].includes(r.status)
    ).length;
    const rate = total > 0 ? ((attended / total) * 100).toFixed(1) + "%" : "N/A";

    return NextResponse.json({
      success: true,
      data: {
        employee: { id: employee.id, name: employee.name, employeeNo: employee.employeeNo, department: employee.department.name },
        records,
        summary: { total, attended, absent: total - attended, rate },
      },
    });
  } catch (error) {
    console.error("Employee stats error:", error);
    return NextResponse.json(
      { success: false, message: "获取员工统计失败" },
      { status: 500 }
    );
  }
}
