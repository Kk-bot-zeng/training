import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// 学员参加考试
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    const { paperId } = await request.json();
    if (!paperId) return NextResponse.json({ success: false, message: "缺少试卷ID" }, { status: 400 });

    const paper = await prisma.examPaper.findUnique({ where: { id: paperId } });
    if (!paper || paper.status !== "published") {
      return NextResponse.json({ success: false, message: "试卷不可用" }, { status: 400 });
    }

    // Check if already attempted
    const existing = await prisma.examAttempt.findFirst({
      where: { paperId, employeeId: user.id, status: { not: "submitted" } },
    });
    if (existing) return NextResponse.json({ success: true, data: existing });

    const attempt = await prisma.examAttempt.create({
      data: { paperId, employeeId: user.id, totalScore: paper.totalScore },
    });
    return NextResponse.json({ success: true, data: attempt });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "Unauthorized") return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
    console.error(e); return NextResponse.json({ success: false, message: "考试开始失败" }, { status: 500 });
  }
}

// 学员提交答卷 + 自动判分
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser();
    const { attemptId, answers, screenSwitches } = await request.json();
    if (!attemptId || !answers) return NextResponse.json({ success: false, message: "参数错误" }, { status: 400 });

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { paper: { include: { paperQuestions: { include: { question: true } } } } },
    });
    if (!attempt || attempt.employeeId !== user.id) {
      return NextResponse.json({ success: false, message: "考试记录不存在" }, { status: 404 });
    }
    if (attempt.status === "submitted") {
      return NextResponse.json({ success: false, message: "已提交" }, { status: 400 });
    }

    // Auto-grade
    const questionMap = new Map(attempt.paper.paperQuestions.map(pq => [pq.questionId, pq]));
    let totalScore = 0;
    const gradedAnswers = answers.map((a: { questionId: number; userAnswer: string }) => {
      const pq = questionMap.get(a.questionId);
      if (!pq) return { ...a, isCorrect: false, score: 0 };
      const q = pq.question;
      const isCorrect = q.type !== "essay" ? (a.userAnswer.trim().toUpperCase() === q.answer.trim().toUpperCase()) : null;
      const score = isCorrect === true ? pq.score : (isCorrect === false ? 0 : 0);
      if (score > 0) totalScore += score;
      return { questionId: a.questionId, userAnswer: a.userAnswer, isCorrect, score };
    });

    const updated = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        endTime: new Date(), score: totalScore,
        answers: JSON.stringify(gradedAnswers),
        status: "submitted",
        screenSwitches: screenSwitches || 0,
      },
    });

    return NextResponse.json({ success: true, data: { ...updated, detail: gradedAnswers } });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "Unauthorized") return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
    console.error(e); return NextResponse.json({ success: false, message: "提交失败" }, { status: 500 });
  }
}
