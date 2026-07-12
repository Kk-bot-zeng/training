import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

type StoredAnswer = {
  questionId: number;
  userAnswer: string;
  isCorrect: boolean | null;
  score: number;
  manuallyGraded?: boolean;
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getAuthAdmin();
    const { id } = await params;
    const paperId = parseInt(id);
    const paper = await prisma.examPaper.findUnique({
      where: { id: paperId },
      select: {
        id: true,
        title: true,
        type: true,
        passScore: true,
        totalScore: true,
        allowRetake: true,
        paperQuestions: {
          orderBy: { order: "asc" },
          select: {
            questionId: true,
            score: true,
            question: { select: { content: true, type: true, answer: true } },
          },
        },
        attempts: {
          where: { status: "submitted" },
          orderBy: { endTime: "desc" },
          select: {
            id: true,
            employeeId: true,
            score: true,
            totalScore: true,
            answers: true,
            startTime: true,
            endTime: true,
            screenSwitches: true,
            employee: {
              select: {
                name: true,
                employeeNo: true,
                department: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!paper) {
      return NextResponse.json({ success: false, message: "试卷不存在" }, { status: 404 });
    }

    const questionMap = new Map(paper.paperQuestions.map((item, index) => [
      item.questionId,
      { index: index + 1, ...item },
    ]));
    const learners = new Map<number, {
      employeeId: number;
      name: string;
      employeeNo: string;
      department: string;
      attempts: Record<string, unknown>[];
    }>();

    for (const attempt of paper.attempts) {
      let answers: StoredAnswer[] = [];
      try { answers = attempt.answers ? JSON.parse(attempt.answers) : []; } catch {}
      const details = answers.map((answer) => {
        const item = questionMap.get(answer.questionId);
        return {
          questionId: answer.questionId,
          questionNo: item?.index,
          content: item?.question.content || "题目已删除",
          type: item?.question.type,
          userAnswer: answer.userAnswer,
          correctAnswer: item?.question.answer || "",
          isCorrect: answer.isCorrect,
          manuallyGraded: answer.manuallyGraded || false,
          score: answer.score,
          maxScore: item?.score || 0,
        };
      });
      const row = learners.get(attempt.employeeId) || {
        employeeId: attempt.employeeId,
        name: attempt.employee.name,
        employeeNo: attempt.employee.employeeNo,
        department: attempt.employee.department.name,
        attempts: [],
      };
      row.attempts.push({
        id: attempt.id,
        score: attempt.score,
        totalScore: attempt.totalScore,
        startTime: attempt.startTime,
        endTime: attempt.endTime,
        screenSwitches: attempt.screenSwitches,
        wrongCount: details.filter((detail) => detail.isCorrect === false).length,
        details,
      });
      learners.set(attempt.employeeId, row);
    }

    const results = [...learners.values()].map((learner) => {
      const scores = learner.attempts.map((attempt) => Number(attempt.score) || 0);
      return {
        ...learner,
        attemptCount: learner.attempts.length,
        bestScore: Math.max(...scores),
        latestScore: scores[0],
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        paper: { id: paper.id, title: paper.title, type: paper.type, passScore: paper.passScore, totalScore: paper.totalScore, allowRetake: paper.allowRetake },
        summary: { learnerCount: results.length, attemptCount: paper.attempts.length },
        results,
      },
    });
  } catch (error) {
    console.error("Get paper results error:", error);
    return NextResponse.json({ success: false, message: "获取考试成绩失败" }, { status: 500 });
  }
}
