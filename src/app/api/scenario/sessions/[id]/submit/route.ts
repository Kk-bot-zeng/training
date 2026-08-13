import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { callScenarioAi, parseAiJson } from "@/lib/scenario-ai";

type Feedback = {
  score: number;
  summary: string;
  strengths: string[];
  problems: string[];
  missedPoints: string[];
  betterReplies: string[];
  dimensions: Array<{ name: string; score: number; fullScore: number }>;
};

const strings = (value: unknown, fallback: string[]) =>
  Array.isArray(value)
    ? value
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 4)
    : fallback;

function normalizeFeedback(
  raw: Record<string, unknown>,
  criteria: Array<Record<string, unknown>>,
): Feedback {
  const score = Math.max(0, Math.min(100, Math.round(Number(raw.score) || 0)));
  const dimensions = Array.isArray(raw.dimensions)
    ? raw.dimensions.slice(0, 10).map((item: any) => ({
        name: String(item?.name || "综合表现"),
        score: Math.max(0, Number(item?.score) || 0),
        fullScore: Math.max(1, Number(item?.fullScore) || 100),
      }))
    : criteria.map((item) => ({
        name: String(item.name || "综合表现"),
        score: Math.round((score * (Number(item.weight) || 0)) / 100),
        fullScore: Number(item.weight) || 0,
      }));
  return {
    score,
    summary: String(raw.summary || "评分已完成，请结合下方建议继续练习。"),
    strengths: strings(raw.strengths, [
      "已完成本次场景演练并持续回应客户需求。",
    ]),
    problems: strings(raw.problems, [
      "建议进一步核实产品信息依据，避免无依据的参数或承诺。",
    ]),
    missedPoints: strings(raw.missedPoints, [
      "可补充需求确认、依据说明和下一步行动建议。",
    ]),
    betterReplies: strings(raw.betterReplies, [
      "我先确认一下您的核心需求，再依据官方资料为您逐项说明；暂未明确的信息，我会帮您向官方渠道核实。",
    ]),
    dimensions,
  };
}

function fallbackFeedback(
  messages: Array<{ role: string; content: string }>,
  criteria: Array<Record<string, unknown>>,
): Feedback {
  const learnerReplies = messages.filter((item) => item.role === "user");
  const usefulLength = learnerReplies.reduce(
    (sum, item) => sum + item.content.trim().length,
    0,
  );
  const score = Math.max(
    40,
    Math.min(
      75,
      40 + learnerReplies.length * 5 + Math.floor(usefulLength / 80),
    ),
  );
  return normalizeFeedback(
    {
      score,
      summary:
        "演练已完成。评分服务本次返回异常，系统已依据对话完成度生成基础报告，管理员可在复盘中进一步核对。",
      strengths: ["完成了客户沟通流程，并对客户追问进行了回应。"],
      problems: ["部分产品信息需要明确引用官方资料，避免使用未经确认的数据。"],
      missedPoints: ["建议加强需求挖掘、信息依据说明及异议处理闭环。"],
      betterReplies: [
        "我理解您的关注点。关于具体参数，我会以官方最新资料为准；同时请问您最关注使用场景、预算还是画质表现？",
      ],
    },
    criteria,
  );
}

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
    let feedback: Feedback;
    try {
      feedback = normalizeFeedback(
        parseAiJson(
          await callScenarioAi([{ role: "user", content: prompt }], true, {
            maxTokens: 1800,
            temperature: 0.1,
            timeoutMs: 75_000,
          }),
        ),
        criteria,
      );
    } catch (firstError) {
      console.warn(
        "Scenario grading response invalid, retrying once:",
        firstError,
      );
      try {
        feedback = normalizeFeedback(
          parseAiJson(
            await callScenarioAi(
              [
                {
                  role: "user",
                  content: `${prompt}\n必须只返回一个完整JSON对象，不要追加第二个JSON、解释或Markdown。`,
                },
              ],
              true,
              {
                maxTokens: 2000,
                temperature: 0,
                timeoutMs: 75_000,
              },
            ),
          ),
          criteria,
        );
      } catch (retryError) {
        console.error(
          "Scenario grading retry failed, using safe report:",
          retryError,
        );
        feedback = fallbackFeedback(messages, criteria);
      }
    }
    const score = feedback.score;
    await prisma.scenarioSession.update({
      where: { id: session.id },
      data: {
        status: "graded",
        score,
        feedback: JSON.stringify(feedback),
        submittedAt: new Date(),
      },
    });
    return NextResponse.json({
      success: true,
      data: { score, feedback },
    });
  } catch (error) {
    console.error("Scenario grading error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "评分报告生成失败，请稍后重试",
      },
      { status: 500 },
    );
  }
}
