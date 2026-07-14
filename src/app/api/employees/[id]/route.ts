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
    const { name, employeeNo, departmentId, phone, status } =
      await request.json();

    const employee = await prisma.employee.update({
      where: { id: parseInt(id) },
      data: {
        name: name?.trim(),
        employeeNo: employeeNo?.trim(),
        departmentId,
        phone: phone?.trim() || null,
        status,
      },
      include: { department: true },
    });

    return NextResponse.json({ success: true, data: employee });
  } catch (error) {
    console.error("Update employee error:", error);
    return NextResponse.json(
      { success: false, message: "更新员工失败" },
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
    const employeeId = parseInt(id);
    await prisma.$transaction(async (tx) => {
      await tx.checkinAudit.deleteMany({ where: { employeeId } });
      await tx.attendance.deleteMany({ where: { employeeId } });
      await tx.examAttempt.deleteMany({ where: { employeeId } });
      await tx.deviceBinding.deleteMany({ where: { employeeId } });
      await tx.employee.delete({ where: { id: employeeId } });
    });
    return NextResponse.json({ success: true, message: "员工账号已彻底删除" });
  } catch (error) {
    console.error("Delete employee error:", error);
    return NextResponse.json(
      { success: false, message: "删除员工账号失败" },
      { status: 500 }
    );
  }
}
