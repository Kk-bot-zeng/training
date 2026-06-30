import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const { id } = await params;
    const departmentId = parseInt(id);

    // Check if department has employees
    const employeeCount = await prisma.employee.count({
      where: { departmentId, status: "active" },
    });
    if (employeeCount > 0) {
      return NextResponse.json(
        { success: false, message: "该部门下还有在职员工，无法删除" },
        { status: 400 }
      );
    }

    await prisma.department.delete({ where: { id: departmentId } });
    return NextResponse.json({ success: true, message: "删除成功" });
  } catch (error) {
    console.error("Delete department error:", error);
    return NextResponse.json(
      { success: false, message: "删除部门失败" },
      { status: 500 }
    );
  }
}
