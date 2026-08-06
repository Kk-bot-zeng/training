import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

type Quota = { model: string; count: number };
const compact = (value: string) => value.toLowerCase().replace(/[\s\-_·]/g, "");

function resolveModel(raw: string, models: string[]) {
  const cleaned = raw.replace(/(?:型号|专属|的)?\s*题(?:目)?$/u, "").trim();
  if (/^(通用|公共|基础)$/u.test(cleaned)) return "通用";
  const key = compact(cleaned);
  return models.find(model => compact(model) === key)
    || models.find(model => compact(model).includes(key) || key.includes(compact(model)))
    || cleaned;
}

function parseInstruction(text: string, models: string[]) {
  const totalScore = Number(text.match(/(?:总分(?:是|为)?|共)\s*(\d+)\s*分/u)?.[1] || 100);
  const quotas: Quota[] = [];
  const forward = /(\d+)\s*道\s*([^，,、。；;]+?)\s*(?:的)?题(?:目)?(?=[，,、。；;]|$)/gu;
  for (const match of text.matchAll(forward)) quotas.push({ count: Number(match[1]), model: resolveModel(match[2], models) });
  const reverse = /([^，,、。；;\d]+?)\s*(?:题(?:目)?)?\s*(\d+)\s*道(?=[，,、。；;]|$)/gu;
  if (!quotas.length) for (const match of text.matchAll(reverse)) quotas.push({ count: Number(match[2]), model: resolveModel(match[1], models) });

  if (!quotas.length) {
    const count = Number(text.match(/(\d+)\s*道题/u)?.[1] || 10);
    const mentioned = models.filter(model => model !== "通用" && compact(text).includes(compact(model))).sort((a, b) => b.length - a.length)[0] || "通用";
    quotas.push({ model: mentioned, count });
  }
  const merged = [...quotas.reduce((map, item) => map.set(item.model, (map.get(item.model) || 0) + item.count), new Map<string, number>())]
    .map(([model, count]) => ({ model, count }));
  return { quotas: merged, totalScore, count: merged.reduce((sum, item) => sum + item.count, 0) };
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}

function allocateScores(weights: number[], total: number) {
  if (total < weights.length) throw new Error(`总分不能低于题目总数 ${weights.length}`);
  const safe = weights.map(value => Math.max(1, value)); const sum = safe.reduce((a, b) => a + b, 0);
  const scores = safe.map(value => Math.max(1, Math.floor(total * value / sum)));
  let remaining = total - scores.reduce((a, b) => a + b, 0);
  const order = safe.map((value, index) => ({ index, fraction: total * value / sum - Math.floor(total * value / sum) })).sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; remaining > 0; i++, remaining--) scores[order[i % order.length].index]++;
  while (remaining < 0) { const index = scores.findIndex(score => score > 1); if (index < 0) break; scores[index]--; remaining++; }
  return scores;
}

export async function POST(request: NextRequest) {
  try {
    await getAuthAdmin(); const { instruction, title } = await request.json();
    if (!instruction) return NextResponse.json({ success: false, message: "请输入组卷指令" }, { status: 400 });
    const modelRows = await prisma.examQuestion.findMany({ distinct: ["productModel"], select: { productModel: true } });
    const models = modelRows.map(item => item.productModel); const plan = parseInstruction(instruction, models);
    if (!plan.count || plan.count > 100 || plan.totalScore < 1 || plan.totalScore > 1000) return NextResponse.json({ success: false, message: "题目总数需为 1-100 道，总分需为 1-1000 分" }, { status: 400 });
    const selected: { id: number; score: number }[] = [];
    for (const quota of plan.quotas) {
      const pool = await prisma.examQuestion.findMany({ where: { productModel: quota.model } });
      if (pool.length < quota.count) return NextResponse.json({ success: false, message: `“${quota.model}”题库仅有 ${pool.length} 道，指令要求 ${quota.count} 道，请补充题目或调整指令` }, { status: 400 });
      selected.push(...shuffle(pool).slice(0, quota.count));
    }
    const scores = allocateScores(selected.map(question => question.score), plan.totalScore);
    const paper = await prisma.examPaper.create({ data: { title: title || `${plan.quotas.map(q => q.model).join("+")}智能组卷`, description: `智能组卷指令：${instruction}`, totalScore: plan.totalScore, passScore: Math.ceil(plan.totalScore * .6), duration: 60, type: "timed", status: "draft", paperQuestions: { create: selected.map((question, index) => ({ questionId: question.id, score: scores[index], order: index })) } } });
    return NextResponse.json({ success: true, data: { paper, plan, questionCount: selected.length } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "智能组卷失败";
    console.error(error); return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
