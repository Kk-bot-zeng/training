import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { gradeEssayAnswers } from "@/lib/ai-essay-grader";

function normalizeSingle(value: string): string {
  const normalized = value.trim().toUpperCase();
  const optionLetter = normalized.match(/^([A-Z])(?:[.、:：\s]|$)/);
  return optionLetter ? optionLetter[1] : normalized;
}

function normalizeJudge(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (["正确", "对", "是", "true", "yes", "√"].includes(normalized)) return "true";
  if (["错误", "错", "否", "false", "no", "×", "x"].includes(normalized)) return "false";
  return normalized;
}

function isObjectiveAnswerCorrect(type: string, userAnswer: string, correctAnswer: string): boolean {
  if (type === "multi") {
    const normalize = (value: string) => value
      .split(/[,，、]/)
      .map(normalizeSingle)
      .filter(Boolean)
      .sort()
      .join(",");
    return normalize(userAnswer) === normalize(correctAnswer);
  }
  if (type === "judge") return normalizeJudge(userAnswer) === normalizeJudge(correctAnswer);
  return normalizeSingle(userAnswer) === normalizeSingle(correctAnswer);
}

export async function GET() {
  try {
    const user = await getAuthUser();
    const attempts = await prisma.examAttempt.findMany({
      where: user.role === "employee" ? { employeeId: user.id, status: { in: ["submitted", "graded"] } } : undefined,
      include: {
        paper: { select: { id: true, title: true, passScore: true, totalScore: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      success: true,
      data: attempts.map((attempt) => {
        let pendingManualGrading = false;
        try {
          const answers = attempt.answers ? JSON.parse(attempt.answers) : [];
          pendingManualGrading = answers.some((answer: { isCorrect: boolean | null; manuallyGraded?: boolean }) =>
            answer.isCorrect === null && !answer.manuallyGraded
          );
        } catch {}
        return { ...attempt, pendingManualGrading };
      }),
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ success: false, message: "获取成绩失败" }, { status: 500 });
  }
}

// 学员参加考试
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (user.role !== "employee") {
      return NextResponse.json({ success: false, message: "仅学员可以参加考试" }, { status: 403 });
    }
    const body = await request.json();
    const paperId = Number(body.paperId);
    if (!Number.isInteger(paperId) || paperId <= 0) return NextResponse.json({ success: false, message: "缺少试卷ID" }, { status: 400 });

    // Serialize "start exam" requests for the same employee and paper. This prevents
    // double taps or client retries from creating duplicate in-progress attempts.
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${paperId}, ${user.id})`;
      const paper = await tx.examPaper.findUnique({ where: { id: paperId } });
      if (!paper || paper.status !== "published") return { error: "试卷不可用", status: 400 } as const;
      const returned = await tx.examAttempt.findFirst({
        where: { paperId, employeeId: user.id, status: "returned" },
        orderBy: { createdAt: "desc" },
      });
      if (returned) {
        const attempt = await tx.examAttempt.update({
          where: { id: returned.id },
          data: { status: "in_progress", startTime: new Date(), endTime: null, score: null, answers: null, screenSwitches: 0, totalScore: paper.totalScore },
        });
        return { attempt } as const;
      }
      const now = Date.now();
      if (paper.startTime && paper.startTime.getTime() > now) return { error: "考试尚未开始", status: 403 } as const;
      if (paper.endTime && paper.endTime.getTime() < now) return { error: "考试已经结束", status: 403 } as const;

      const attempts = await tx.examAttempt.findMany({
        where: { paperId, employeeId: user.id },
        orderBy: { createdAt: "desc" },
        take: Math.max(2, paper.retakeCount + 1),
      });
      const existing = attempts.find((attempt) => attempt.status === "in_progress");
      if (existing) return { attempt: existing } as const;
      const submittedCount = attempts.filter((attempt) => ["submitted", "graded"].includes(attempt.status)).length;
      if (!paper.allowRetake && submittedCount > 0) return { error: "该考试只能参加一次，你已完成考试", status: 409 } as const;
      if (paper.allowRetake && submittedCount > paper.retakeCount) return { error: "已达到允许的考试次数", status: 409 } as const;
      const attempt = await tx.examAttempt.create({ data: { paperId, employeeId: user.id, totalScore: paper.totalScore } });
      return { attempt } as const;
    }, { maxWait: 10_000, timeout: 15_000 });

    if ("error" in result) return NextResponse.json({ success: false, message: result.error }, { status: result.status });
    return NextResponse.json({ success: true, data: result.attempt });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "Unauthorized") return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
    console.error(e); return NextResponse.json({ success: false, message: "考试开始失败" }, { status: 500 });
  }
}

// Persist every screen switch so refresh/re-entry cannot reset the count.
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (user.role !== "employee") return NextResponse.json({ success: false, message: "仅学员可参加考试" }, { status: 403 });
    const { attemptId, action, answers } = await request.json();
    if (!Number.isInteger(attemptId)) return NextResponse.json({ success: false, message: "参数错误" }, { status: 400 });
    const safeAnswers = Array.isArray(answers) ? answers.slice(0, 500).flatMap((answer: { questionId?: unknown; userAnswer?: unknown }) => {
      const questionId = Number(answer.questionId);
      if (!Number.isInteger(questionId)) return [];
      return [{ questionId, userAnswer: String(answer.userAnswer || "").slice(0, 10_000) }];
    }) : null;
    if (action === "autosave") {
      const saved = await prisma.examAttempt.updateMany({
        where: { id: attemptId, employeeId: user.id, status: "in_progress" },
        data: safeAnswers ? { answers: JSON.stringify(safeAnswers) } : {},
      });
      if (!saved.count) return NextResponse.json({ success: false, message: "考试已结束或记录不存在" }, { status: 409 });
      return NextResponse.json({ success: true, data: { savedAt: new Date().toISOString() } });
    }
    const updated = await prisma.examAttempt.updateMany({
      where: { id: attemptId, employeeId: user.id, status: "in_progress", screenSwitches: { lt: 3 } },
      data: { screenSwitches: { increment: 1 }, ...(safeAnswers ? { answers: JSON.stringify(safeAnswers) } : {}) },
    });
    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, employeeId: user.id }, select: { screenSwitches: true, status: true },
    });
    if (!attempt) return NextResponse.json({ success: false, message: "考试记录不存在" }, { status: 404 });
    if (!updated.count && attempt.status !== "in_progress") return NextResponse.json({ success: false, message: "考试已结束" }, { status: 409 });
    return NextResponse.json({ success: true, data: attempt });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "切屏记录失败" }, { status: 500 });
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
    if (["submitted", "graded"].includes(attempt.status)) {
      return NextResponse.json({ success: true, data: { id: attempt.id, status: attempt.status, score: attempt.score, alreadySubmitted: true } });
    }

    // Auto-grade
    const questionMap = new Map(attempt.paper.paperQuestions.map(pq => [pq.questionId, pq]));
    let totalScore = 0;
    const gradedAnswers = answers.map((a: { questionId: number; userAnswer: string }) => {
      const pq = questionMap.get(a.questionId);
      if (!pq) return { ...a, isCorrect: false, score: 0 };
      const q = pq.question;
      const isCorrect = q.type !== "essay" ? isObjectiveAnswerCorrect(q.type, a.userAnswer, q.answer) : null;
      const score = isCorrect === true ? pq.score : 0;
      if (score > 0) totalScore += score;
      return { questionId: a.questionId, userAnswer: a.userAnswer, isCorrect, score };
    });

    const updated = await prisma.examAttempt.updateMany({
      where: { id: attemptId, employeeId: user.id, status: "in_progress" },
      data: {
        endTime: new Date(), score: totalScore,
        answers: JSON.stringify(gradedAnswers),
        status: "submitted",
        screenSwitches: Math.min(3, Math.max(attempt.screenSwitches, Number(screenSwitches) || 0)),
      },
    });
    if (!updated.count) {
      const latest = await prisma.examAttempt.findUnique({ where: { id: attemptId }, select: { status: true, score: true } });
      if (latest && ["submitted", "graded"].includes(latest.status)) {
        return NextResponse.json({ success: true, data: { id: attemptId, ...latest, alreadySubmitted: true } });
      }
      return NextResponse.json({ success: false, message: "交卷状态已变化，请刷新后确认" }, { status: 409 });
    }

    const essayInputs = answers.flatMap((answer: { questionId: number; userAnswer: string }) => {
      const paperQuestion = questionMap.get(answer.questionId);
      if (!paperQuestion || paperQuestion.question.type !== "essay") return [];
      return [{ questionId: answer.questionId, question: paperQuestion.question.content, referenceAnswer: paperQuestion.question.answer, userAnswer: String(answer.userAnswer || ""), maxScore: paperQuestion.score }];
    });
    if (essayInputs.length) after(async () => {
      try {
        const essayGrades = await gradeEssayAnswers(essayInputs);
        if (!essayGrades.size) return;
        const latest = await prisma.examAttempt.findUnique({ where: { id: attemptId }, select: { answers: true, status: true } });
        if (!latest || !["submitted", "graded"].includes(latest.status)) return;
        let latestAnswers: Array<Record<string, unknown>> = [];
        try { latestAnswers = JSON.parse(latest.answers || "[]"); } catch { return; }
        const merged = latestAnswers.map((answer) => {
          if (answer.manuallyGraded) return answer;
          const grade = essayGrades.get(Number(answer.questionId));
          return grade ? { ...answer, score: grade.score, manuallyGraded: true, gradingMethod: "ai", aiReason: grade.reason, aiConfidence: grade.confidence } : answer;
        });
        const finalScore = merged.reduce((sum, answer) => sum + (Number(answer.score) || 0), 0);
        await prisma.examAttempt.update({ where: { id: attemptId }, data: { answers: JSON.stringify(merged), score: finalScore } });
      } catch (error) { console.error("Background essay grading failed", error); }
    });

    return NextResponse.json({ success: true, data: { id: attemptId, status: "submitted", score: totalScore, detail: gradedAnswers } });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "Unauthorized") return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
    console.error(e); return NextResponse.json({ success: false, message: "提交失败" }, { status: 500 });
  }
}
