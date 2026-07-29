import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin, getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    const employee = user.role === "employee"
      ? await prisma.employee.findUnique({ where: { id: user.id }, select: { departmentId: true } })
      : null;
    const assignments = await prisma.assignment.findMany({
      where: user.role === "employee" ? { status: "published" } : undefined,
      include: user.role === "admin"
        ? { _count: { select: { submissions: true } } }
        : { submissions: { where: { employeeId: user.id } } },
      orderBy: { dueDate: "desc" },
    });
    const visibleAssignments = user.role === "employee"
      ? assignments.filter((assignment) => {
          const ids = JSON.parse(assignment.departmentIds || "[]") as number[];
          return ids.length === 0 || (employee && ids.includes(employee.departmentId));
        })
      : assignments;
    return NextResponse.json({ success: true, data: visibleAssignments });
  } catch (error) {
    console.error("Get assignments error:", error);
    return NextResponse.json({ success: false, message: "获取作业失败" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await getAuthAdmin();
    const { title, description, departmentIds, dueDate, status } = await request.json();
    if (!title?.trim() || !dueDate) {
      return NextResponse.json({ success: false, message: "作业标题和截止时间不能为空" }, { status: 400 });
    }
    const assignment = await prisma.assignment.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        departmentIds: JSON.stringify(Array.isArray(departmentIds) ? departmentIds.map(Number) : []),
        dueDate: new Date(dueDate),
        status: status || "published",
      },
    });
    return NextResponse.json({ success: true, data: assignment });
  } catch (error) {
    console.error("Create assignment error:", error);
    return NextResponse.json({ success: false, message: "创建作业失败" }, { status: 500 });
  }
}
