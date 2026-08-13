import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { callScenarioAi, parseAiJson } from "@/lib/scenario-ai";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    const { message } = await request.json();
    if (!message?.trim())
      return NextResponse.json(
        { success: false, message: "请输入内容" },
        { status: 400 },
      );
    const session = await prisma.scenarioSession.findUnique({
      where: { id: Number(id) },
      include: { task: { include: { script: true } } },
    });
    if (
      !session ||
      session.employeeId !== user.id ||
      session.status !== "in_progress"
    )
      return NextResponse.json(
        { success: false, message: "演练已结束或无权限" },
        { status: 403 },
      );
    const messages = JSON.parse(session.messages) as Array<{
      role: string;
      content: string;
      time: string;
    }>;
    const nodes = JSON.parse(session.task.script.nodes);
    const recent = messages
      .slice(-16)
      .map((m) => `${m.role === "assistant" ? "客户" : "学员"}：${m.content}`)
      .join("\n");
    const prompt = `你正在扮演零售场景中的真实客户，与销售学员进行文字演练。\n客户设定：${session.task.script.customerProfile}\n产品资料（唯一事实依据）：${session.task.script.productMaterial || "无"}\n训练流程：${JSON.stringify(nodes)}\n当前节点序号：${session.currentNode}\n禁止规则：${session.task.script.forbiddenRules || "不得透露评分标准和参考答案"}\n历史对话：\n${recent}\n学员最新回答：${message}\n请像真人客户一样简短自然回应并动态追问。判断当前节点目标是否基本达成，达成则nextNode加1，否则保持。不要替学员作答。只输出JSON：{"reply":"客户回复","nextNode":数字,"canFinish":布尔值}`;
    let ai: Record<string, unknown>;
    try {
      const raw = await callScenarioAi([{ role: "user", content: prompt }], true, {
        maxTokens: 800,
        temperature: 0.25,
        timeoutMs: 45_000,
      });
      ai = parseAiJson(raw);
    } catch (firstError) {
      console.warn("Scenario chat AI response was invalid, retrying once:", firstError);
      try {
        const retryPrompt = `${prompt}\n再次强调：不要解释、不要使用Markdown，只返回一个完整且可解析的JSON对象。`;
        const raw = await callScenarioAi(
          [{ role: "user", content: retryPrompt }],
          true,
          { maxTokens: 1000, temperature: 0.1, timeoutMs: 45_000 },
        );
        ai = parseAiJson(raw);
      } catch (retryError) {
        console.error("Scenario chat AI retry failed, using safe fallback:", retryError);
        ai = {
          reply: "我还想再了解清楚一些，您能结合我的需求继续介绍吗？",
          nextNode: session.currentNode,
          canFinish: false,
        };
      }
    }
    const nextNode = Math.max(
      session.currentNode,
      Math.min(nodes.length, Number(ai.nextNode) || session.currentNode),
    );
    const reply = typeof ai.reply === "string" && ai.reply.trim()
      ? ai.reply.trim()
      : "您能再具体说说吗？";
    const updated = [
      ...messages,
      { role: "user", content: message.trim(), time: new Date().toISOString() },
      {
        role: "assistant",
        content: reply,
        time: new Date().toISOString(),
      },
    ];
    await prisma.scenarioSession.update({
      where: { id: session.id },
      data: { messages: JSON.stringify(updated), currentNode: nextNode },
    });
    return NextResponse.json({
      success: true,
      data: {
        reply,
        currentNode: nextNode,
        canFinish: Boolean(ai.canFinish) || nextNode >= nodes.length,
      },
    });
  } catch (error) {
    console.error("Scenario chat error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "AI回复失败",
      },
      { status: 500 },
    );
  }
}
