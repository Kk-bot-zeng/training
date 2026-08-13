import { NextRequest, NextResponse } from "next/server";
import { getAuthAdmin } from "@/lib/auth";
import { callScenarioAi, parseAiJson, scenarioScriptShape } from "@/lib/scenario-ai";

type JsonRecord = Record<string, unknown>;

const DEFAULT_SCORING = [
  { name: "需求挖掘", weight: 25, description: "能够通过提问确认顾客的真实需求和使用场景" },
  { name: "产品讲解", weight: 25, description: "基于已提供资料准确说明产品价值，不虚构参数" },
  { name: "异议处理", weight: 25, description: "能够理解顾虑并给出有针对性的回应" },
  { name: "沟通与推进", weight: 25, description: "表达自然清晰，并能合理推动下一步" },
];

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeScoring(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_SCORING;
  const criteria = value.map((item, index) => {
    const row = item && typeof item === "object" ? (item as JsonRecord) : {};
    const weight = Number(row.weight);
    return {
      name: text(row.name, `评分项${index + 1}`),
      weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
      description: text(row.description, "根据学员在该项中的实际表现评分"),
    };
  });
  const total = criteria.reduce((sum, item) => sum + item.weight, 0);
  let assigned = 0;
  return criteria.map((item, index) => {
    const weight = index === criteria.length - 1
      ? 100 - assigned
      : Math.max(1, Math.round((item.weight / total) * 100));
    assigned += weight;
    return { ...item, weight };
  });
}

function normalizeScript(value: unknown, body: JsonRecord) {
  const raw = value && typeof value === "object" ? (value as JsonRecord) : {};
  const sourceNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const nodes = sourceNodes.map((item, index) => {
    const node = item && typeof item === "object" ? (item as JsonRecord) : {};
    return {
      name: text(node.name ?? node.node, `流程节点${index + 1}`),
      customerBehavior: text(node.customerBehavior, "顾客根据学员的回答继续表达需求或顾虑"),
      learnerGoal: text(node.learnerGoal, "准确理解顾客需求并作出回应"),
      passCondition: text(node.passCondition, "学员完成本阶段目标后进入下一节点"),
      referenceTalking: text(node.referenceTalking, "先确认需求，再依据已提供的产品资料进行说明"),
    };
  });
  if (nodes.length === 0) throw new Error("AI没有返回有效剧本节点");
  const productModel = text(body.productModel, "通用产品");
  return {
    name: text(raw.name, `${productModel}场景演练`),
    customerProfile: text(raw.customerProfile, "有明确使用需求、希望获得专业建议的顾客"),
    trainingGoal: text(raw.trainingGoal, "训练需求挖掘、产品推荐、异议处理和成交引导能力"),
    forbiddenRules: text(raw.forbiddenRules, "不得虚构产品参数、价格、政策或具体承诺"),
    openingMessage: text(raw.openingMessage, "你好，我想了解一下这款产品，能帮我介绍一下吗？"),
    nodes,
    scoringCriteria: normalizeScoring(raw.scoringCriteria),
  };
}

function fallbackScript(body: JsonRecord) {
  const productModel = text(body.productModel, "通用产品");
  const nodeNames = ["开场与需求确认", "使用场景挖掘", "产品说明", "异议处理", "总结与下一步"];
  return {
    name: `${productModel}场景演练`,
    customerProfile: "有购买意向、希望销售根据实际使用场景提供建议的顾客",
    trainingGoal: text(body.instruction, "训练需求挖掘、产品推荐、异议处理和成交引导能力"),
    forbiddenRules: "不得虚构产品参数、价格、优惠、售后政策或联系方式；资料未说明的内容须提示以官方最新信息为准",
    openingMessage: `你好，我想了解一下${productModel}，可以根据我的需求介绍一下吗？`,
    nodes: nodeNames.map((name, index) => ({
      name,
      customerBehavior: index === 0 ? "顾客表达初步咨询意向，等待学员主动提问" : "顾客根据学员的回答继续表达需求或顾虑",
      learnerGoal: index === 0 ? "礼貌开场并确认顾客的核心需求" : "结合当前阶段准确回应，并自然推进沟通",
      passCondition: "学员完成本阶段目标后进入下一节点",
      referenceTalking: "先确认顾客需求，再依据已提供的产品资料进行说明；未知信息以官方最新信息为准",
    })),
    scoringCriteria: DEFAULT_SCORING,
  };
}

export async function POST(request: NextRequest) {
  try {
    await getAuthAdmin();
    const body = (await request.json()) as JsonRecord;
    const modeLabel: Record<string, string> = { product: "商品知识训练", practical: "实战能力进阶", custom: "自定义内容" };
    const prompt = `你是雷鸟电视与显示器零售培训专家。请生成一个可供AI扮演顾客、学员扮演销售的完整文字场景演练剧本。\n生成方式：${modeLabel[String(body.generationMode)] || "自定义内容"}\n产品型号：${body.productModel || "通用"}\n产品资料：${body.productMaterial || "未提供，禁止虚构具体参数"}\n管理员指令：${body.instruction || "训练需求挖掘、产品推荐、异议处理和成交引导"}\n难度：${body.difficulty || "standard"}\n要求生成5个递进节点，内容精炼；客户要像真人一样根据学员回答动态追问；评分权重合计100。\n【最高优先级事实约束】产品参数、价格、优惠、安装费用、保修范围、退换货政策、门店、电话、平台规则等，只能引用“产品资料”中明确写出的内容。资料没有写明时，剧本必须要求学员回答“需以官方最新政策/页面/客服确认为准”，严禁补充常识、假设数字、虚构联系方式或具体承诺。${scenarioScriptShape}`;

    let firstError: unknown;
    try {
      const response = await callScenarioAi([{ role: "user", content: prompt }], true, { maxTokens: 4200, temperature: 0.1, timeoutMs: 90_000 });
      return NextResponse.json({ success: true, data: normalizeScript(parseAiJson(response), body) });
    } catch (error) {
      firstError = error;
      console.warn("Scenario script first generation failed, retrying:", error);
    }

    try {
      const retryPrompt = `${prompt}\n上一次输出不完整。本次严格只返回一个完整JSON对象，不要Markdown、解释或额外文字。固定生成5个节点，每个字段控制在120字以内，务必正确闭合所有数组、字符串和大括号。`;
      const response = await callScenarioAi([{ role: "user", content: retryPrompt }], true, { maxTokens: 4500, temperature: 0, timeoutMs: 90_000 });
      return NextResponse.json({ success: true, data: normalizeScript(parseAiJson(response), body), retried: true });
    } catch (retryError) {
      console.error("Scenario script generation failed, using fallback:", { firstError, retryError });
      return NextResponse.json({
        success: true,
        data: fallbackScript(body),
        fallback: true,
        message: "AI返回异常，已生成可编辑的基础剧本，请确认后保存。",
      });
    }
  } catch (error) {
    console.error("Generate scenario script error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "AI生成失败，请稍后重试" }, { status: 500 });
  }
}
