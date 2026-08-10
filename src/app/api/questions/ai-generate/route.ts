import { NextRequest, NextResponse } from "next/server";
import { getAuthAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 180;

type GeneratedQuestion = {
  type: "single" | "multi" | "judge" | "essay";
  difficulty: "easy" | "medium" | "hard";
  content: string;
  options: string[];
  answer: string;
  score: number;
  analysis: string;
  source: string;
};

const SUPPORTED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "bmp", "tif", "tiff", "heif", "docx", "xlsx", "pptx"]);
const ALLOWED_TYPES = new Set(["single", "multi", "judge", "essay"]);
const ALLOWED_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

function extractJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型没有返回有效的题目数据");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeQuestions(value: unknown, count: number): GeneratedQuestion[] {
  const rows = Array.isArray((value as { questions?: unknown[] })?.questions)
    ? (value as { questions: unknown[] }).questions
    : [];

  return rows.slice(0, count).flatMap((item) => {
    const row = item as Record<string, unknown>;
    const type = String(row.type || "");
    const difficulty = String(row.difficulty || "medium");
    const content = String(row.content || "").trim();
    const answer = String(row.answer || "").trim();
    const options = Array.isArray(row.options) ? row.options.map((option) => String(option).trim()).filter(Boolean).slice(0, 6) : [];
    if (!ALLOWED_TYPES.has(type) || !ALLOWED_DIFFICULTIES.has(difficulty) || !content || (type !== "essay" && !answer)) return [];
    if (["single", "multi"].includes(type) && options.length < 2) return [];
    return [{
      type: type as GeneratedQuestion["type"],
      difficulty: difficulty as GeneratedQuestion["difficulty"],
      content,
      options: ["judge", "essay"].includes(type) ? [] : options,
      answer,
      score: Math.max(1, Math.min(100, Number(row.score) || 2)),
      analysis: String(row.analysis || "").trim(),
      source: String(row.source || "").trim(),
    }];
  });
}

export async function POST(request: NextRequest) {
  try {
    await getAuthAdmin();
    const apiKey = process.env.TURING_API_KEY;
    const baseUrl = (process.env.TURING_BASE_URL || "https://live-turing.cn.llm.tcljd.com/api/v1").replace(/\/$/, "");
    const model = process.env.TURING_MODEL || "deepseek-v4-pro";
    if (!apiKey) return NextResponse.json({ success: false, message: "AI 服务尚未配置，请联系管理员" }, { status: 503 });

    const form = await request.formData();
    const file = form.get("file");
    const category = String(form.get("category") || "通用").trim() || "通用";
    const count = Math.max(1, Math.min(50, Number(form.get("count")) || 10));
    const difficulty = String(form.get("difficulty") || "medium");
    const requestedTypes = String(form.get("types") || "single,multi,judge").split(",").filter((type) => ALLOWED_TYPES.has(type));
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ success: false, message: "请选择要解析的资料" }, { status: 400 });
    if (file.size > 30 * 1024 * 1024) return NextResponse.json({ success: false, message: "资料文件不能超过 30MB" }, { status: 400 });
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!SUPPORTED_EXTENSIONS.has(extension)) return NextResponse.json({ success: false, message: "暂不支持该文件格式" }, { status: 400 });

    const documentForm = new FormData();
    documentForm.append("files", file, file.name);
    const documentResponse = await fetch(`${baseUrl}/documents/azure/document2md`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: documentForm,
      signal: AbortSignal.timeout(120_000),
    });
    const documentData = await documentResponse.json().catch(() => null);
    if (!documentResponse.ok) throw new Error(documentData?.error?.message || documentData?.message || "资料解析失败");
    const result = documentData?.data?.results?.[0];
    const markdown = String(result?.markdown || "").replace(/!\[[^\]]*\]\(figure:\/\/[^)]+\)/g, "").trim();
    if (!markdown) throw new Error(result?.error || "未能从资料中识别出文字内容");

    const prompt = `你是雷鸟产品培训题库专家。请严格依据下方资料生成 ${count} 道题，不得补充资料中没有的信息。\n\n要求：\n1. 题目分类为“${category}”。\n2. 允许题型：${requestedTypes.join("、")}。single=单选，multi=多选，judge=判断，essay=问答。\n3. 默认难度：${difficulty}，可按内容合理微调。\n4. 单选/多选提供 4 个选项，格式为“A. 内容”；单选答案如“A”，多选答案如“A,C”；判断答案只能为“正确”或“错误”；问答题给出参考答案。\n5. 每题给出答案解析，并在 source 中摘录支撑答案的原文短句。\n6. 避免重复、歧义、主观猜测和“以上都正确”类选项。\n7. 只输出 JSON，不要输出 Markdown。格式：{"questions":[{"type":"single","difficulty":"medium","content":"题目","options":["A. 选项"],"answer":"A","score":2,"analysis":"解析","source":"资料原文"}]}\n\n资料内容：\n${markdown.slice(0, 80_000)}`;
    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.2, max_tokens: 12_000 }),
      signal: AbortSignal.timeout(150_000),
    });
    const aiData = await aiResponse.json().catch(() => null);
    if (!aiResponse.ok) throw new Error(aiData?.error?.message || aiData?.message || "AI 生成失败");
    const content = aiData?.choices?.[0]?.message?.content;
    const questions = normalizeQuestions(extractJson(String(content || "")), count);
    if (!questions.length) throw new Error("AI 未生成符合题库格式的题目，请调整设置后重试");

    return NextResponse.json({ success: true, data: { category, questions, sourceFile: file.name, requested: count } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 生成失败";
    const status = /Unauthorized|Forbidden/.test(message) ? 401 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
