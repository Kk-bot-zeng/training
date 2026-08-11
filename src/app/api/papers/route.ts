import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin, getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    const status = request.nextUrl.searchParams.get("status");
    if (status === "published") {
      if (user.role === "employee") {
        const papers = await prisma.examPaper.findMany({
          where: { status: "published" },
          include: {
            attempts: {
              where: { employeeId: user.id },
              select: { status: true },
            },
            _count: { select: { paperQuestions: true } },
          },
          orderBy: { createdAt: "desc" },
        });
        return NextResponse.json({
          success: true,
          data: papers.map(({ attempts, ...paper }) => {
            const completedAttempts = attempts.filter((attempt) => ["submitted", "graded"].includes(attempt.status)).length;
            const hasReturnedAttempt = attempts.some((attempt) => attempt.status === "returned");
            const now = Date.now();
            const withinWindow = (!paper.startTime || paper.startTime.getTime() <= now) && (!paper.endTime || paper.endTime.getTime() >= now);
            return {
              ...paper,
              completedAttempts,
              returnedForRetake: hasReturnedAttempt,
              canAttempt: hasReturnedAttempt || (withinWindow && (paper.allowRetake || completedAttempts === 0)),
              availability: hasReturnedAttempt ? "returned" : !withinWindow ? (paper.startTime && paper.startTime.getTime() > now ? "not_started" : "ended") : "available",
            };
          }),
        });
      }
    }
    if (user.role !== "admin") return NextResponse.json({ success: false, message: "无权访问" }, { status: 403 });
    const papers = await prisma.examPaper.findMany({
      where: status ? { status } : undefined,
      include: { _count: { select: { paperQuestions: true, attempts: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: papers });
  } catch (e) { console.error(e); return NextResponse.json({ success: false, message: "获取失败" }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    await getAuthAdmin();
    const body = await request.json();
    const { title, description, type, duration, passScore, totalScore, startTime, endTime,
      shuffleQuestions, shuffleOptions, allowRetake, retakeCount, questions } = body;

    if (!title) return NextResponse.json({ success: false, message: "试卷标题不能为空" }, { status: 400 });

    // Create paper
    const paper = await prisma.examPaper.create({
      data: {
        title, description: description || null, type: type || "timed",
        duration: duration || 60, passScore: passScore || 60, totalScore: totalScore || 100,
        startTime: startTime ? new Date(startTime) : null, endTime: endTime ? new Date(endTime) : null,
        shuffleQuestions: shuffleQuestions ?? true, shuffleOptions: shuffleOptions ?? true,
        maxSwitch: 3, allowRetake: allowRetake ?? false, retakeCount: retakeCount ?? 1,
        status: body.status || "draft",
      },
    });

    // Attach questions if provided
    if (questions && questions.length > 0) {
      await prisma.examPaperQuestion.createMany({
        data: questions.map((q: { questionId: number; score: number }, idx: number) => ({
          paperId: paper.id, questionId: q.questionId, score: q.score || 2, order: idx,
        })),
      });
    }

    return NextResponse.json({ success: true, data: paper });
  } catch (e) { console.error(e); return NextResponse.json({ success: false, message: "创建失败" }, { status: 500 }); }
}
