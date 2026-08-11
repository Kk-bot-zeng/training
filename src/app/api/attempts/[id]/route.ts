import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin, getAuthUser } from "@/lib/auth";

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
    if (user.role === "employee") {
      return NextResponse.json({
        success: true,
        data: {
          ...attempt,
          paper: {
            ...attempt.paper,
            paperQuestions: attempt.paper.paperQuestions.map(({ question, ...paperQuestion }) => ({
              ...paperQuestion,
              question: {
                id: question.id, type: question.type, content: question.content,
                options: question.options, score: question.score,
                productModel: question.productModel, category: question.category, difficulty: question.difficulty,
              },
            })),
          },
        },
      });
    }
    return NextResponse.json({ success: true, data: attempt });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "Unauthorized") return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
    return NextResponse.json({ success: false, message: "获取失败" }, { status: 500 });
  }
}

// Return one submitted paper to a specific learner for a fresh attempt.
export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getAuthAdmin();
    const { id } = await params;
    const attemptId = Number(id);
    if (!Number.isInteger(attemptId) || attemptId <= 0) {
      return NextResponse.json({ success: false, message: "答卷参数无效" }, { status: 400 });
    }
    const result = await prisma.$transaction(async (tx) => {
      const attempt = await tx.examAttempt.findUnique({
        where: { id: attemptId },
        include: { paper: { select: { status: true, title: true } }, employee: { select: { name: true } } },
      });
      if (!attempt) return { error: "答卷不存在", status: 404 } as const;
      if (!["submitted", "graded"].includes(attempt.status)) return { error: "只有已提交的答卷可以打回", status: 409 } as const;
      if (attempt.paper.status !== "published") return { error: "请先发布该试卷，再打回学员重考", status: 409 } as const;
      const active = await tx.examAttempt.findFirst({
        where: { paperId: attempt.paperId, employeeId: attempt.employeeId, id: { not: attempt.id }, status: { in: ["in_progress", "returned"] } },
        select: { id: true },
      });
      if (active) return { error: "该学员已有正在作答或待重考的记录，不能重复打回", status: 409 } as const;
      await tx.examAttempt.update({ where: { id: attempt.id }, data: { status: "returned" } });
      return { attempt: { id: attempt.id, learner: attempt.employee.name, paper: attempt.paper.title } } as const;
    });
    if ("error" in result) return NextResponse.json({ success: false, message: result.error }, { status: result.status });
    return NextResponse.json({ success: true, data: result.attempt });
  } catch (error) {
    console.error("Return exam attempt error:", error);
    return NextResponse.json({ success: false, message: "打回答卷失败" }, { status: 500 });
  }
}
