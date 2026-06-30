import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { employees: true } } },
    });
    return NextResponse.json({ success: true, data: departments });
  } catch (error) {
    console.error("Get departments error:", error);
    return NextResponse.json(
      { success: false, message: "获取部门列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, message: "部门名称不能为空" },
        { status: 400 }
      );
    }

    const existing = await prisma.department.findUnique({
      where: { name: name.trim() },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "该部门已存在" },
        { status: 400 }
      );
    }

    const department = await prisma.department.create({
      data: { name: name.trim() },
    });
    return NextResponse.json({ success: true, data: department });
  } catch (error) {
    console.error("Create department error:", error);
    return NextResponse.json(
      { success: false, message: "创建部门失败" },
      { status: 500 }
    );
  }
}
