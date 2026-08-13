import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { callScenarioAi, parseAiJson } from "@/lib/scenario-ai";

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    const session = await prisma.scenarioSession.findUnique({
      where: { id: Number(id) },
      include: { task: { include: { script: true } } },
    });
    if (!session || session.employeeId !== user.id)
      return NextResponse.json(
        { success: false, message: "无权限" },
        { status: 403 },
      );
    if (session.status !== "in_progress")
      return NextResponse.json({
        success: true,
        data: {
          score: session.score,
          feedback: session.feedback ? JSON.parse(session.feedback) : null,
        },
      });
    const criteria = JSON.parse(session.task.script.scoringCriteria);
    const messages = (
      JSON.parse(session.messages) as Array<{ role: string; content: string }>
    ).map(({ role, content }) => ({ role, content }));
    const prompt = `你是严格、公正的雷鸟零售培训评委。依据产品资料、训练目标和评分标准评价学员与AI客户的完整对话。不得因客户说法给学员加分，产品知识与资料冲突必须扣分。评价简洁、具体，每个列表最多4项。\n产品资料：${session.task.script.productMaterial || "无"}\n训练目标：${session.task.script.trainingGoal}\n评分标准：${JSON.stringify(criteria)}\n对话：${JSON.stringify(messages)}\n只输出JSON：{"score":0到100整数,"summary":"总体评价","strengths":["优点"],"problems":["知识错误或沟通问题"],"missedPoints":["遗漏点"],"betterReplies":["更优话术"],"dimensions":[{"name":"维度","score":数字,"fullScore":数字}]}`;
    const feedback = parseAiJson(
      await callScenarioAi([{ role: "user", content: prompt }], true, {
        maxTokens: 1400,
        temperature: 0.1,
        timeoutMs: 60_000,
      }),
    );
    const score = Math.max(
      0,
      Math.min(100, Math.round(Number(feedback.score) || 0)),
    );
    await prisma.scenarioSession.update({
      where: { id: session.id },
      data: {
        status: "graded",
        score,
        feedback: JSON.stringify({ ...feedback, score }),
        submittedAt: new Date(),
      },
    });
    return NextResponse.json({
      success: true,
      data: { score, feedback: { ...feedback, score } },
    });
  } catch (error) {
    console.error("Scenario grading error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "评分失败",
      },
      { status: 500 },
    );
  }
}
