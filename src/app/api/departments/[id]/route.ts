import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthAdmin();
    const { id } = await params;
    const { name } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, message: "部门名称不能为空" },
        { status: 400 }
      );
    }

    const department = await prisma.department.update({
      where: { id: parseInt(id) },
      data: { name: name.trim() },
    });
    return NextResponse.json({ success: true, data: department });
  } catch (error) {
    console.error("Update department error:", error);
    return NextResponse.json(
      { success: false, message: "更新部门失败" },
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
    const departmentId = parseInt(id);

    const deletedCount = await prisma.$transaction(async (tx) => {
      const employees = await tx.employee.findMany({
        where: { departmentId },
        select: { id: true },
      });
      const employeeIds = employees.map((employee) => employee.id);

      if (employeeIds.length > 0) {
        const employeeFilter = { employeeId: { in: employeeIds } };
        await tx.checkinAudit.deleteMany({ where: employeeFilter });
        await tx.attendance.deleteMany({ where: employeeFilter });
        await tx.examAttempt.deleteMany({ where: employeeFilter });
        await tx.deviceBinding.deleteMany({ where: employeeFilter });
        await tx.employee.deleteMany({ where: { id: { in: employeeIds } } });
      }
      await tx.department.delete({ where: { id: departmentId } });
      return employeeIds.length;
    });
    return NextResponse.json({
      success: true,
      message: `部门及其 ${deletedCount} 名员工已彻底删除`,
    });
  } catch (error) {
    console.error("Delete department error:", error);
    return NextResponse.json(
      { success: false, message: "删除部门失败" },
      { status: 500 }
    );
  }
}
