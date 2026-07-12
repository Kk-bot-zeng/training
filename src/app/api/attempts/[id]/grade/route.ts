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

function normalizeSingle(value: string): string {
  const normalized = value.trim().toUpperCase();
  const optionLetter = normalized.match(/^([A-Z])(?:[.、:：\s]|$)/);
  return optionLetter ? optionLetter[1] : normalized;
}

function isCorrect(type: string, userAnswer: string, correctAnswer: string): boolean {
  if (type === "multi") {
    const normalize = (value: string) => value.split(/[,，、]/).map(normalizeSingle).filter(Boolean).sort().join(",");
    return normalize(userAnswer) === normalize(correctAnswer);
  }
  if (type === "judge") {
    const normalize = (value: string) => {
      const answer = value.trim().toLowerCase();
      if (["正确", "对", "是", "true", "yes", "√"].includes(answer)) return "true";
      if (["错误", "错", "否", "false", "no", "×", "x"].includes(answer)) return "false";
      return answer;
    };
    return normalize(userAnswer) === normalize(correctAnswer);
  }
  return normalizeSingle(userAnswer) === normalizeSingle(correctAnswer);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getAuthAdmin();
    const { id } = await params;
    const { grades } = await request.json() as { grades: { questionId: number; score: number }[] };
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: parseInt(id) },
      include: { paper: { include: { paperQuestions: { include: { question: true } } } } },
    });
    if (!attempt) return NextResponse.json({ success: false, message: "答卷不存在" }, { status: 404 });

    let answers: StoredAnswer[] = [];
    try { answers = attempt.answers ? JSON.parse(attempt.answers) : []; } catch {}
    const gradeMap = new Map(grades.map((grade) => [grade.questionId, Number(grade.score)]));
    const paperQuestionMap = new Map(attempt.paper.paperQuestions.map((item) => [item.questionId, item]));

    const updatedAnswers = answers.map((answer) => {
      const item = paperQuestionMap.get(answer.questionId);
      if (!item) return answer;
      if (item.question.type !== "essay") {
        const correct = isCorrect(item.question.type, answer.userAnswer, item.question.answer);
        return { ...answer, isCorrect: correct, score: correct ? item.score : 0 };
      }
      if (!gradeMap.has(answer.questionId)) return answer;
      const requestedScore = gradeMap.get(answer.questionId) || 0;
      const score = Math.max(0, Math.min(item.score, requestedScore));
      return { ...answer, score, isCorrect: null, manuallyGraded: true };
    });
    const totalScore = updatedAnswers.reduce((sum, answer) => sum + (Number(answer.score) || 0), 0);
    const updated = await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { answers: JSON.stringify(updatedAnswers), score: totalScore },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Grade attempt error:", error);
    return NextResponse.json({ success: false, message: "保存评分失败" }, { status: 500 });
  }
}
