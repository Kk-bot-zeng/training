import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthAdmin();
    const { id } = await params;
    const trainingId = parseInt(id);
    const { employeeId, status, remark } = await request.json();

    const allowedStatuses = new Set(["present", "late", "leave", "absent"]);
    if (!employeeId || !allowedStatuses.has(status)) {
      return NextResponse.json(
        { success: false, message: "员工和状态不能为空" },
        { status: 400 }
      );
    }

    const record = await prisma.attendance.upsert({
      where: {
        trainingId_employeeId: { trainingId, employeeId },
      },
      update: {
        status,
        remark: remark?.trim() || null,
        checkInTime: ["present", "late"].includes(status) ? new Date() : null,
      },
      create: {
        trainingId,
        employeeId,
        status,
        remark: remark?.trim() || null,
        checkInTime: ["present", "late"].includes(status) ? new Date() : null,
      },
      include: {
        employee: { include: { department: true } },
      },
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error("Manual checkin error:", error);
    return NextResponse.json(
      { success: false, message: "操作失败" },
      { status: 500 }
    );
  }
}
