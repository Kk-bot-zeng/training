import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const paper = await prisma.examPaper.findUnique({
      where: { id: parseInt(id) },
      include: {
        paperQuestions: { include: { question: true }, orderBy: { order: "asc" } },
        _count: { select: { attempts: true } },
      },
    });
    if (!paper) return NextResponse.json({ success: false, message: "试卷不存在" }, { status: 404 });
    return NextResponse.json({ success: true, data: paper });
  } catch (e) { console.error(e); return NextResponse.json({ success: false, message: "获取失败" }, { status: 500 }); }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const paperId = parseInt(id);
    const body = await request.json();
    const data: Record<string, unknown> = {};
    const fields = ["title","description","type","duration","passScore","totalScore","status","shuffleQuestions","shuffleOptions","maxSwitch","allowRetake","retakeCount"];
    for (const f of fields) if (body[f] !== undefined) data[f] = body[f];
    if (body.startTime) data.startTime = new Date(body.startTime);
    if (body.endTime) data.endTime = new Date(body.endTime);

    const questions = Array.isArray(body.questions) ? body.questions : null;
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
    return NextResponse.json({ success: true, data: paper });
  } catch (e) { console.error(e); return NextResponse.json({ success: false, message: "更新失败" }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const paperId = parseInt(id);
    await prisma.$transaction([
      prisma.examAttempt.deleteMany({ where: { paperId } }),
      prisma.examPaper.delete({ where: { id: paperId } }),
    ]);
    return NextResponse.json({ success: true, message: "删除成功" });
  } catch (e) { console.error(e); return NextResponse.json({ success: false, message: "删除失败" }, { status: 500 }); }
}
