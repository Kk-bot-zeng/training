import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await getAuthAdmin();
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const status = searchParams.get("status");
    const search = searchParams.get("search") || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 20));
    const compact = searchParams.get("compact") === "true";

    const where: Record<string, unknown> = {};
    if (departmentId) where.departmentId = parseInt(departmentId);
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { employeeNo: { contains: search } },
      ];
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        select: compact
          ? { id: true, name: true, employeeNo: true, department: { select: { name: true } } }
          : {
              id: true, name: true, employeeNo: true, departmentId: true,
              department: true, status: true, phone: true, createdAt: true,
            },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.employee.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: { items: employees, total, page, pageSize } });
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
