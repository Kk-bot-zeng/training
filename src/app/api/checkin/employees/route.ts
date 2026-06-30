import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const qrToken = request.nextUrl.searchParams.get("qrToken");
    const search = request.nextUrl.searchParams.get("search") || "";

    if (!qrToken) {
      return NextResponse.json(
        { success: false, message: "参数错误" },
        { status: 400 }
      );
    }

    const training = await prisma.training.findUnique({
      where: { qrToken },
      select: { id: true, departmentIds: true, status: true },
    });

    if (!training) {
      return NextResponse.json(
        { success: false, message: "培训不存在" },
        { status: 404 }
      );
    }

    if (training.status === "completed") {
      return NextResponse.json(
        { success: false, message: "培训已结束" },
        { status: 400 }
      );
    }

    const departmentIds = JSON.parse(training.departmentIds) as number[];

    const where: Record<string, unknown> = {
      departmentId: { in: departmentIds },
      status: "active",
    };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { employeeNo: { contains: search } },
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      include: { department: { select: { name: true } } },
      orderBy: { name: "asc" },
    });

    // Check existing attendance
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        trainingId: training.id,
        employeeId: { in: employees.map((e) => e.id) },
      },
    });

    const checkedInMap = new Map(
      attendanceRecords.map((a) => [a.employeeId, a])
    );

    const result = employees.map((emp) => {
      const record = checkedInMap.get(emp.id);
      return {
        id: emp.id,
        name: emp.name,
        employeeNo: emp.employeeNo,
        departmentName: emp.department.name,
        checkedIn: !!record,
        status: record?.status || null,
        checkInTime: record?.checkInTime || null,
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Get checkin employees error:", error);
    return NextResponse.json(
      { success: false, message: "获取员工列表失败" },
      { status: 500 }
    );
  }
}
