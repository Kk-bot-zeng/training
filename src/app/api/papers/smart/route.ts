import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

type Quota = { model: string; count: number };
type Question = { id: number; score: number };
const compact = (value: string) => value.toLowerCase().replace(/[\s\-_·]/g, "");
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function mentionedModels(text: string, models: string[]) {
  const source = compact(text);
  const found = models.filter(model => model !== "通用" && source.includes(compact(model)));
  if (/通用|公共题|基础题/u.test(text)) found.push("通用");
  return [...new Set(found)];
}

function explicitQuota(text: string, model: string) {
  const name = model === "通用" ? "(?:通用|公共|基础)" : escapeRegExp(model).replace(/\s+/g, "\\s*");
  const before = text.match(new RegExp(`(\\d+)\\s*道\\s*${name}(?:\\s*(?:专属)?题(?:目)?)?`, "iu"));
  if (before) return Number(before[1]);
  const after = text.match(new RegExp(`${name}(?:\\s*(?:专属)?题(?:目)?)?\\s*(\\d+)\\s*道`, "iu"));
  if (after && !/(?:一共|共|总共|合计)\s*\d+\s*道/u.test(after[0])) return Number(after[1]);
  return null;
}

function parseInstruction(text: string, models: string[]) {
  const totalScore = Number(text.match(/(?:总分(?:是|为)?|共)\s*(\d+)\s*分/u)?.[1] || 100);
  const mentioned = mentionedModels(text, models);
  const quotas = mentioned.flatMap(model => { const count = explicitQuota(text, model); return count ? [{ model, count }] : []; });
  const totalCount = Number(text.match(/(?:一共|总共|合计|共)\s*(\d+)\s*道/u)?.[1] || text.match(/(\d+)\s*道题/u)?.[1] || 10);
  if (quotas.length && quotas.length !== mentioned.length) throw new Error("部分分类指定了题数、部分未指定。请为每个分类都写明题数，或只写“一共多少道”让系统自动分配");
  if (quotas.length) return { mode: "exact" as const, quotas, models: mentioned, totalScore, count: quotas.reduce((sum, item) => sum + item.count, 0) };
  const targetModels = mentioned.length ? mentioned : ["通用"];
  return { mode: "balanced" as const, quotas: [] as Quota[], models: targetModels, totalScore, count: totalCount };
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}

function balancedSelect(pools: Map<string, Question[]>, count: number) {
  const selected: Question[] = []; const names = [...pools.keys()]; let cursor = 0; let emptyRounds = 0;
  while (selected.length < count && emptyRounds < names.length) {
    const pool = pools.get(names[cursor % names.length])!;
    if (pool.length) { selected.push(pool.shift()!); emptyRounds = 0; } else emptyRounds++;
    cursor++;
  }
  return selected;
}

function allocateScores(weights: number[], total: number) {
  if (total < weights.length) throw new Error(`总分不能低于题目总数 ${weights.length}`);
  const safe = weights.map(value => Math.max(1, value)); const sum = safe.reduce((a, b) => a + b, 0);
  const scores = safe.map(value => Math.max(1, Math.floor(total * value / sum))); let remaining = total - scores.reduce((a, b) => a + b, 0);
  const order = safe.map((value, index) => ({ index, fraction: total * value / sum - Math.floor(total * value / sum) })).sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; remaining > 0; i++, remaining--) scores[order[i % order.length].index]++;
  while (remaining < 0) { const index = scores.findIndex(score => score > 1); if (index < 0) break; scores[index]--; remaining++; }
  return scores;
}

export async function POST(request: NextRequest) {
  try {
    await getAuthAdmin(); const { instruction, title } = await request.json();
    if (!instruction) return NextResponse.json({ success: false, message: "请输入组卷指令" }, { status: 400 });
    const rows = await prisma.examQuestion.findMany({ distinct: ["productModel"], select: { productModel: true } });
    const plan = parseInstruction(instruction, rows.map(item => item.productModel));
    if (!plan.count || plan.count > 100 || plan.totalScore < 1 || plan.totalScore > 1000) return NextResponse.json({ success: false, message: "题目总数需为 1-100 道，总分需为 1-1000 分" }, { status: 400 });
    let selected: Question[] = [];
    if (plan.mode === "exact") {
      for (const quota of plan.quotas) {
        const pool = await prisma.examQuestion.findMany({ where: { productModel: quota.model }, select: { id: true, score: true } });
        if (pool.length < quota.count) return NextResponse.json({ success: false, message: `“${quota.model}”题库仅有 ${pool.length} 道，指令要求 ${quota.count} 道` }, { status: 400 });
        selected.push(...shuffle(pool).slice(0, quota.count));
      }
    } else {
      const pools = new Map<string, Question[]>();
      for (const model of plan.models) pools.set(model, shuffle(await prisma.examQuestion.findMany({ where: { productModel: model }, select: { id: true, score: true } })));
      const available = [...pools.values()].reduce((sum, pool) => sum + pool.length, 0);
      if (available < plan.count) return NextResponse.json({ success: false, message: `所选分类合计只有 ${available} 道题，无法组成 ${plan.count} 道` }, { status: 400 });
      selected = balancedSelect(pools, plan.count);
    }
    const scores = allocateScores(selected.map(question => question.score), plan.totalScore);
    const paper = await prisma.examPaper.create({ data: { title: title || `${plan.models.join("+")}智能组卷`, description: `智能组卷指令：${instruction}`, totalScore: plan.totalScore, passScore: Math.ceil(plan.totalScore * .6), duration: 60, type: "timed", status: "draft", paperQuestions: { create: selected.map((question, index) => ({ questionId: question.id, score: scores[index], order: index })) } } });
    return NextResponse.json({ success: true, data: { paper, plan, questionCount: selected.length } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "智能组卷失败"; console.error(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
