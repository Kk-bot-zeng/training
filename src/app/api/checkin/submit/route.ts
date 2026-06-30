import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { qrToken, employeeId, remark } = await request.json();

    if (!qrToken || !employeeId) {
      return NextResponse.json(
        { success: false, message: "参数错误" },
        { status: 400 }
      );
    }

    const training = await prisma.training.findUnique({
      where: { qrToken },
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

    // Verify employee belongs to training departments
    const departmentIds = JSON.parse(training.departmentIds) as number[];
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee || employee.status !== "active") {
      return NextResponse.json(
        { success: false, message: "员工不存在或已离职" },
        { status: 400 }
      );
    }

    if (!departmentIds.includes(employee.departmentId)) {
      return NextResponse.json(
        { success: false, message: "您不属于本次培训范围" },
        { status: 400 }
      );
    }

    // Check existing record
    const existing = await prisma.attendance.findUnique({
      where: {
        trainingId_employeeId: { trainingId: training.id, employeeId },
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        message: `已签到 (${existing.status === "present" ? "出席" : existing.status === "late" ? "迟到" : existing.status})`,
        data: {
          employeeName: employee.name,
          checkInTime: existing.checkInTime,
          status: existing.status,
        },
      });
    }

    // Determine late: > 15 min after start time
    const [startHour, startMinute] = training.startTime.split(":").map(Number);
    const trainingStart = new Date(training.date);
    trainingStart.setHours(startHour, startMinute, 0, 0);
    const lateThreshold = new Date(trainingStart.getTime() + 15 * 60 * 1000);
    const effectiveStatus = new Date() > lateThreshold ? "late" : "present";

    const record = await prisma.attendance.create({
      data: {
        trainingId: training.id,
        employeeId,
        status: effectiveStatus,
        checkInTime: new Date(),
        remark: remark?.trim() || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `签到成功 (${effectiveStatus === "present" ? "出席" : "迟到"})`,
      data: {
        employeeName: employee.name,
        checkInTime: record.checkInTime,
        status: record.status,
      },
    });
  } catch (error) {
    console.error("Submit checkin error:", error);
    return NextResponse.json(
      { success: false, message: "签到失败" },
      { status: 500 }
    );
  }
}
