import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";
import { getRequestAccessOrigin } from "@/lib/access-origin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthAdmin();
    const { id } = await params;
    const training = await prisma.training.findUnique({
      where: { id: parseInt(id) },
      include: {
        attendance: {
          include: {
            employee: { include: { department: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!training) {
      return NextResponse.json(
        { success: false, message: "培训不存在" },
        { status: 404 }
      );
    }

    const departmentIds = JSON.parse(training.departmentIds || "[]") as number[];
    const eligibleEmployees = await prisma.employee.findMany({
      where: { departmentId: { in: departmentIds }, status: "active" },
      include: { department: true },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
    });
    const attendanceByEmployee = new Map(training.attendance.map((record) => [record.employeeId, record]));
    const attendance = eligibleEmployees.map((employee) => {
      const record = attendanceByEmployee.get(employee.id);
      return record || {
        id: `pending-${employee.id}`,
        trainingId: training.id,
        employeeId: employee.id,
        employee,
        status: "pending",
        checkInTime: null,
        remark: null,
        createdAt: null,
      };
    });

    // Preserve historical records if an employee later leaves the company or changes department.
    const eligibleIds = new Set(eligibleEmployees.map((employee) => employee.id));
    attendance.push(...training.attendance.filter((record) => !eligibleIds.has(record.employeeId)));

    const present = attendance.filter((record) => record.status === "present").length;
    const late = attendance.filter((record) => record.status === "late").length;
    const leave = attendance.filter((record) => record.status === "leave").length;
    const absent = attendance.filter((record) => record.status === "absent").length;
    const pending = attendance.filter((record) => record.status === "pending").length;

    return NextResponse.json({
      success: true,
      data: {
        ...training,
        attendance,
        checkinUrl: `${getRequestAccessOrigin(request)}/checkin/${training.qrToken}`,
        summary: { total: attendance.length, present, late, leave, absent, pending },
      },
    });
  } catch (error) {
    console.error("Get training error:", error);
    return NextResponse.json(
      { success: false, message: "获取培训详情失败" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthAdmin();
    const { id } = await params;
    const body = await request.json();
    const training = await prisma.training.findUnique({ where: { id: parseInt(id) } });
    if (!training) {
      return NextResponse.json(
        { success: false, message: "培训不存在" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.title) updateData.title = body.title.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.type) updateData.type = body.type;
    if (body.date) updateData.date = new Date(body.date);
    if (body.startTime) updateData.startTime = body.startTime;
    if (body.endTime) updateData.endTime = body.endTime;
    if (body.location !== undefined) updateData.location = body.location?.trim() || null;
    if (body.departmentIds) updateData.departmentIds = JSON.stringify(body.departmentIds);

    // Handle status change to completed: atomically mark all remaining eligible employees absent.
    if (body.status === "completed" && training.status !== "completed") {
      updateData.status = "completed";

      const departmentIds = Array.isArray(body.departmentIds)
        ? body.departmentIds.map(Number)
        : JSON.parse(training.departmentIds || "[]") as number[];
      const updated = await prisma.$transaction(async (tx) => {
        const eligibleEmployees = await tx.employee.findMany({
          where: { departmentId: { in: departmentIds }, status: "active" },
          select: { id: true },
        });
        const existingRecords = await tx.attendance.findMany({
          where: { trainingId: parseInt(id) },
          select: { employeeId: true },
        });
        const existingIds = new Set(existingRecords.map((record) => record.employeeId));
        const absentIds = eligibleEmployees
          .filter((employee) => !existingIds.has(employee.id))
          .map((employee) => employee.id);

        if (absentIds.length > 0) {
          await tx.attendance.createMany({
            data: absentIds.map((employeeId) => ({
              trainingId: parseInt(id), employeeId, status: "absent",
            })),
            skipDuplicates: true,
          });
        }
        return tx.training.update({ where: { id: parseInt(id) }, data: updateData });
      });
      return NextResponse.json({ success: true, data: updated });
    } else if (body.status) {
      updateData.status = body.status;
    }

    const updated = await prisma.training.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update training error:", error);
    return NextResponse.json(
      { success: false, message: "更新培训失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthAdmin();
    const { id } = await params;
    await prisma.training.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true, message: "删除成功" });
  } catch (error) {
    console.error("Delete training error:", error);
    return NextResponse.json(
      { success: false, message: "删除培训失败" },
      { status: 500 }
    );
  }
}
