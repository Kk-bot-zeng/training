import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

type StoredAnswer = { questionId: number; userAnswer?: string; isCorrect?: boolean | null; score?: number; manuallyGraded?: boolean; gradingMethod?: string };
const typeLabels: Record<string, string> = { single: "单选题", multi: "多选题", judge: "判断题", essay: "问答题" };

function styleSheet(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173EC8" } };
  header.alignment = { horizontal: "center", vertical: "middle" };
  header.height = 28;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  sheet.eachRow((row, index) => {
    row.alignment = { vertical: "middle", wrapText: true };
    if (index > 1 && index % 2 === 0) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F7FC" } };
  });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getAuthAdmin();
    const { id } = await params;
    const paper = await prisma.examPaper.findUnique({
      where: { id: Number(id) },
      include: {
        paperQuestions: { include: { question: true }, orderBy: { order: "asc" } },
        attempts: {
          where: { status: { in: ["submitted", "graded"] } },
          include: { employee: { include: { department: true } } },
          orderBy: [{ employeeId: "asc" }, { endTime: "asc" }],
        },
      },
    });
    if (!paper) return NextResponse.json({ success: false, message: "试卷不存在" }, { status: 404 });

    const questionMap = new Map(paper.paperQuestions.map((item, index) => [item.questionId, { ...item, questionNo: index + 1 }]));
    const attemptSequence = new Map<number, number>();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "雷鸟培训系统";
    workbook.created = new Date();

    const summary = workbook.addWorksheet("成绩汇总");
    summary.columns = [
      { header: "试卷", key: "paper", width: 30 }, { header: "学员", key: "name", width: 14 },
      { header: "工号", key: "employeeNo", width: 16 }, { header: "部门", key: "department", width: 20 },
      { header: "考试次数", key: "sequence", width: 12 }, { header: "成绩", key: "score", width: 10 },
      { header: "总分", key: "total", width: 10 }, { header: "是否及格", key: "passed", width: 12 },
      { header: "错题数", key: "wrongCount", width: 10 }, { header: "待复核问答题", key: "pending", width: 14 },
      { header: "提交时间", key: "endTime", width: 22 }, { header: "切屏次数", key: "switches", width: 12 },
    ];

    const mistakes = workbook.addWorksheet("错题明细");
    mistakes.columns = [
      { header: "学员", key: "name", width: 14 }, { header: "工号", key: "employeeNo", width: 16 },
      { header: "部门", key: "department", width: 20 }, { header: "考试次数", key: "sequence", width: 12 },
      { header: "题号", key: "questionNo", width: 9 }, { header: "题型", key: "type", width: 10 },
      { header: "题目", key: "content", width: 48 }, { header: "学员答案", key: "userAnswer", width: 32 },
      { header: "正确/参考答案", key: "correctAnswer", width: 38 }, { header: "得分", key: "score", width: 9 },
      { header: "满分", key: "maxScore", width: 9 }, { header: "评卷状态", key: "grading", width: 14 },
      { header: "提交时间", key: "endTime", width: 22 },
    ];

    for (const attempt of paper.attempts) {
      const sequence = (attemptSequence.get(attempt.employeeId) || 0) + 1;
      attemptSequence.set(attempt.employeeId, sequence);
      let answers: StoredAnswer[] = [];
      try { answers = JSON.parse(attempt.answers || "[]"); } catch {}
      let wrongCount = 0; let pending = 0;
      for (const answer of answers) {
        const item = questionMap.get(answer.questionId); if (!item) continue;
        const isEssay = item.question.type === "essay";
        const isPending = isEssay && !answer.manuallyGraded;
        const isWrong = isEssay ? (Number(answer.score) || 0) < item.score : answer.isCorrect === false;
        if (isPending) pending++;
        if (!isWrong && !isPending) continue;
        if (isWrong) wrongCount++;
        mistakes.addRow({
          name: attempt.employee.name, employeeNo: attempt.employee.employeeNo || "", department: attempt.employee.department.name,
          sequence: `第${sequence}次`, questionNo: item.questionNo, type: typeLabels[item.question.type] || item.question.type,
          content: item.question.content, userAnswer: answer.userAnswer || "未作答", correctAnswer: item.question.answer,
          score: Number(answer.score) || 0, maxScore: item.score,
          grading: isPending ? "待人工复核" : answer.gradingMethod === "ai" ? "AI已评分" : isEssay ? "人工已评分" : "自动判分",
          endTime: attempt.endTime ? dayjs(attempt.endTime).format("YYYY-MM-DD HH:mm:ss") : "",
        });
      }
      summary.addRow({
        paper: paper.title, name: attempt.employee.name, employeeNo: attempt.employee.employeeNo || "", department: attempt.employee.department.name,
        sequence: `第${sequence}次`, score: attempt.score ?? 0, total: attempt.totalScore,
        passed: (attempt.score ?? 0) >= paper.passScore ? "及格" : "未及格", wrongCount, pending,
        endTime: attempt.endTime ? dayjs(attempt.endTime).format("YYYY-MM-DD HH:mm:ss") : "", switches: attempt.screenSwitches,
      });
    }
    if (mistakes.rowCount === 1) mistakes.addRow({ content: "本试卷暂无错题记录" });
    styleSheet(summary); styleSheet(mistakes);
    const buffer = await workbook.xlsx.writeBuffer();
    const safeTitle = paper.title.replace(/[\\/:*?"<>|]/g, "_");
    return new NextResponse(Buffer.from(buffer), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${safeTitle}-成绩与错题.xlsx`)}`,
      "Cache-Control": "no-store",
    } });
  } catch (error) {
    console.error("Export exam results error:", error);
    return NextResponse.json({ success: false, message: "导出成绩与错题失败" }, { status: 500 });
  }
}
