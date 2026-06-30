import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const { id } = await params;
    // Soft delete - set status to inactive
    await prisma.employee.update({
      where: { id: parseInt(id) },
      data: { status: "inactive" },
    });
    return NextResponse.json({ success: true, message: "已设置为离职" });
  } catch (error) {
    console.error("Delete employee error:", error);
    return NextResponse.json(
      { success: false, message: "操作失败" },
      { status: 500 }
    );
  }
}
