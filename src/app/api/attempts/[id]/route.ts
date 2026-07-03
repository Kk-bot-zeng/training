import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// Get attempt detail (for exam page)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: parseInt(id) },
      include: {
        paper: {
          include: { paperQuestions: { include: { question: true }, orderBy: { order: "asc" } } },
        },
        employee: { select: { name: true, employeeNo: true, department: { select: { name: true } } } },
      },
    });
    if (!attempt || (user.role !== "admin" && attempt.employeeId !== user.id)) {
      return NextResponse.json({ success: false, message: "记录不存在" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: attempt });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "Unauthorized") return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
    return NextResponse.json({ success: false, message: "获取失败" }, { status: 500 });
  }
}
