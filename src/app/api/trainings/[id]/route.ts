import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Calculate summary
    const totalRecords = training.attendance.length;
    const present = training.attendance.filter((a) => a.status === "present").length;
    const late = training.attendance.filter((a) => a.status === "late").length;
    const leave = training.attendance.filter((a) => a.status === "leave").length;
    const absent = training.attendance.filter((a) => a.status === "absent").length;

    return NextResponse.json({
      success: true,
      data: {
        ...training,
        checkinUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/checkin/${training.qrToken}`,
        summary: { total: totalRecords, present, late, leave, absent },
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

    // Handle status change to completed: auto-mark absent employees
    if (body.status === "completed" && training.status !== "completed") {
      updateData.status = "completed";

      const departmentIds = JSON.parse(training.departmentIds) as number[];
      const eligibleEmployees = await prisma.employee.findMany({
        where: { departmentId: { in: departmentIds }, status: "active" },
        select: { id: true },
      });
      const existingRecords = await prisma.attendance.findMany({
        where: { trainingId: parseInt(id) },
        select: { employeeId: true },
      });
      const existingIds = new Set(existingRecords.map((r) => r.employeeId));
      const absentIds = eligibleEmployees.filter((e) => !existingIds.has(e.id)).map((e) => e.id);

      if (absentIds.length > 0) {
        await prisma.attendance.createMany({
          data: absentIds.map((employeeId) => ({
            trainingId: parseInt(id),
            employeeId,
            status: "absent",
          })),
        });
      }
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
