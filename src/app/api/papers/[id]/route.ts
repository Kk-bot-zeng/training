import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin, getAuthUser } from "@/lib/auth";

const employeePaperCache = new Map<number, { data: Record<string, unknown>; expiresAt: number }>();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    const paperId = parseInt(id);
    if (user.role === "employee") {
      const cached = employeePaperCache.get(paperId);
      if (cached && cached.expiresAt > Date.now()) return NextResponse.json({ success: true, data: cached.data });
    }
    const paper = await prisma.examPaper.findUnique({
      where: { id: paperId },
      include: {
        paperQuestions: { include: { question: true }, orderBy: { order: "asc" } },
        _count: { select: { attempts: true } },
      },
    });
    if (!paper) return NextResponse.json({ success: false, message: "试卷不存在" }, { status: 404 });
    if (user.role === "employee") {
      const now = Date.now();
      if (paper.status !== "published") return NextResponse.json({ success: false, message: "该试卷尚未发布或已关闭" }, { status: 403 });
      if (paper.startTime && paper.startTime.getTime() > now) return NextResponse.json({ success: false, message: "考试尚未开始" }, { status: 403 });
      if (paper.endTime && paper.endTime.getTime() < now) return NextResponse.json({ success: false, message: "考试已经结束" }, { status: 403 });
      const employeeData = {
        ...paper,
        paperQuestions: paper.paperQuestions.map(({ question, ...paperQuestion }) => ({
            ...paperQuestion,
            question: {
              id: question.id, type: question.type, content: question.content,
              options: question.options, score: question.score,
              productModel: question.productModel, category: question.category, difficulty: question.difficulty,
            },
          })),
      };
      employeePaperCache.set(paperId, { data: employeeData, expiresAt: Date.now() + 30_000 });
      if (employeePaperCache.size > 20) employeePaperCache.delete(employeePaperCache.keys().next().value!);
      return NextResponse.json({ success: true, data: employeeData });
    }
    return NextResponse.json({ success: true, data: paper });
  } catch (e) { console.error(e); return NextResponse.json({ success: false, message: "获取失败" }, { status: 500 }); }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getAuthAdmin();
    const { id } = await params;
    const paperId = parseInt(id);
    const body = await request.json();
    const data: Record<string, unknown> = {};
    const fields = ["title","description","type","duration","passScore","totalScore","status","shuffleQuestions","shuffleOptions","allowRetake","retakeCount"];
    for (const f of fields) if (body[f] !== undefined) data[f] = body[f];
    data.maxSwitch = 3;
    if (body.startTime) data.startTime = new Date(body.startTime);
    if (body.endTime) data.endTime = new Date(body.endTime);

    const questions = Array.isArray(body.questions) ? body.questions : null;
    if (questions && questions.length > 0) {
      const selectedQuestions = await prisma.examQuestion.findMany({
        where: { id: { in: questions.map((question: { questionId: number }) => question.questionId) } },
        select: { id: true, type: true, options: true },
      });
      const invalid = selectedQuestions.find((question) =>
        ["single", "multi"].includes(question.type) && !question.options
      );
      if (invalid) {
        return NextResponse.json(
          { success: false, message: "试卷中有选择题未填写选项，请先到题库编辑补充" },
          { status: 400 }
        );
      }
    }
    const questionCount = questions
      ? questions.length
      : await prisma.examPaperQuestion.count({ where: { paperId } });
    if (body.status === "published" && questionCount === 0) {
      return NextResponse.json(
        { success: false, message: "请先为试卷选择题目，再发布考试" },
        { status: 400 }
      );
    }

    const paper = await prisma.$transaction(async (tx) => {
      if (questions) {
        await tx.examPaperQuestion.deleteMany({ where: { paperId } });
        if (questions.length > 0) {
          await tx.examPaperQuestion.createMany({
            data: questions.map((question: { questionId: number; score?: number }, order: number) => ({
              paperId,
              questionId: question.questionId,
              score: question.score || 2,
              order,
            })),
          });
        }
      }
      return tx.examPaper.update({ where: { id: paperId }, data });
    });
    employeePaperCache.delete(paperId);
    return NextResponse.json({ success: true, data: paper });
  } catch (e) { console.error(e); return NextResponse.json({ success: false, message: "更新失败" }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getAuthAdmin();
    const { id } = await params;
    const paperId = parseInt(id);
    await prisma.$transaction([
      prisma.examAttempt.deleteMany({ where: { paperId } }),
      prisma.examPaper.delete({ where: { id: paperId } }),
    ]);
    employeePaperCache.delete(paperId);
    return NextResponse.json({ success: true, message: "删除成功" });
  } catch (e) { console.error(e); return NextResponse.json({ success: false, message: "删除失败" }, { status: 500 }); }
}
