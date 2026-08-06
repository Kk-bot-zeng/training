import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

function parse(text: string) {
  const count = Number(text.match(/(\d+)\s*道题/)?.[1] || 10);
  const totalScore = Number(text.match(/(?:共|总)?\s*(\d+)\s*分/)?.[1] || 100);
  const model = text.match(/(?:创建|一套|给我|针对)\s*([^，。,.]*?)(?:的)?试卷/)?.[1]?.trim() || "通用";
  return { count: Math.min(Math.max(count, 1), 100), totalScore: Math.min(Math.max(totalScore, 1), 1000), model };
}
export async function POST(request: NextRequest) {
  try {
    await getAuthAdmin(); const { instruction, title } = await request.json();
    if (!instruction) return NextResponse.json({ success: false, message: "请输入组卷指令" }, { status: 400 });
    const plan = parse(instruction);
    const pool = await prisma.examQuestion.findMany({ where: { productModel: { in: [plan.model, "通用"] } } });
    if (pool.length < plan.count) return NextResponse.json({ success: false, message: `“${plan.model}”及通用题库仅有 ${pool.length} 道题，无法抽取 ${plan.count} 道` }, { status: 400 });
    const selected = [...pool].sort(() => Math.random() - .5).slice(0, plan.count);
    const base = Math.floor(plan.totalScore / plan.count), extra = plan.totalScore % plan.count;
    const paper = await prisma.examPaper.create({ data: { title: title || `${plan.model}自动组卷`, description: `智能组卷指令：${instruction}`, totalScore: plan.totalScore, passScore: Math.ceil(plan.totalScore * .6), duration: 60, type: "timed", status: "draft", paperQuestions: { create: selected.map((q, i) => ({ questionId: q.id, score: base + (i < extra ? 1 : 0), order: i })) } } });
    return NextResponse.json({ success: true, data: { paper, plan, questionCount: selected.length } });
  } catch (error) { console.error(error); return NextResponse.json({ success: false, message: "智能组卷失败" }, { status: 500 }); }
}
