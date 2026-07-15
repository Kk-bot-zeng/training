import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const status = searchParams.get("status");
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {};
    if (departmentId) where.departmentId = parseInt(departmentId);
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { employeeNo: { contains: search } },
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      include: { department: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: employees });
  } catch (error) {
    console.error("Get employees error:", error);
    return NextResponse.json(
      { success: false, message: "获取员工列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await getAuthAdmin();
    const { name, employeeNo, departmentId, phone, status } =
      await request.json();
    const normalizedEmployeeNo = employeeNo?.trim() || null;

    if (!name?.trim() || !departmentId) {
      return NextResponse.json(
        { success: false, message: "姓名和部门不能为空" },
        { status: 400 }
      );
    }

    if (normalizedEmployeeNo) {
      const existing = await prisma.employee.findUnique({
        where: { employeeNo: normalizedEmployeeNo },
      });
      if (existing) {
        return NextResponse.json(
          { success: false, message: "该工号已存在" },
          { status: 400 }
        );
      }
    }

    const employee = await prisma.employee.create({
      data: {
        name: name.trim(),
        employeeNo: normalizedEmployeeNo,
        departmentId,
        phone: phone?.trim() || null,
        status: status || "active",
      },
      include: { department: true },
    });

    return NextResponse.json({ success: true, data: employee });
  } catch (error) {
    console.error("Create employee error:", error);
    return NextResponse.json(
      { success: false, message: "创建员工失败" },
      { status: 500 }
    );
  }
}
