import { NextRequest, NextResponse } from "next/server";
import { getAuthAdmin } from "@/lib/auth";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import JSZip from "jszip";

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
const parseCache = new Map<string, { text: string; method: string; createdAt: number }>();

function decodeXmlText(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function extractLocally(buffer: Buffer, extension: string): Promise<{ text: string; method: string } | null> {
  if (extension === "xlsx") {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const text = workbook.SheetNames.map((name) => `# ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`).join("\n\n").trim();
    return text.length >= 20 ? { text, method: "Excel 本地解析" } : null;
  }
  if (extension === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();
    return text.length >= 80 ? { text, method: "Word 本地解析" } : null;
  }
  if (extension === "pptx") {
    const archive = await JSZip.loadAsync(buffer);
    const slideNames = Object.keys(archive.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((left, right) => Number(left.match(/\d+/)?.[0]) - Number(right.match(/\d+/)?.[0]));
    const slides = await Promise.all(slideNames.map(async (name, index) => {
      const xml = await archive.files[name].async("string");
      const lines = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((match) => decodeXmlText(match[1]).trim()).filter(Boolean);
      return `# 第 ${index + 1} 页\n${lines.join("\n")}`;
    }));
    const text = slides.join("\n\n").trim();
    return text.length >= 80 ? { text, method: "PPT 本地解析" } : null;
  }
  return null;
}

async function extractWithDocumentService(file: File, baseUrl: string, apiKey: string) {
  const documentForm = new FormData();
  documentForm.append("files", file, file.name);
  const response = await fetch(`${baseUrl}/documents/azure/document2md`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: documentForm,
    signal: AbortSignal.timeout(120_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || data?.message || "资料解析失败");
  const result = data?.data?.results?.[0];
  const text = String(result?.markdown || "").replace(/!\[[^\]]*\]\(figure:\/\/[^)]+\)/g, "").trim();
  if (!text) throw new Error(result?.error || "未能从资料中识别出文字内容");
  return { text, method: "OCR/版面识别" };
}

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
    const model = process.env.TURING_MODEL || "deepseek-v4-flash";
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

    const totalStartedAt = Date.now();
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(buffer).digest("hex");
    const cached = parseCache.get(fileHash);
    const parseStartedAt = Date.now();
    let extracted = cached ? { text: cached.text, method: `${cached.method}（缓存）` } : null;
    if (!extracted) {
      try { extracted = await extractLocally(buffer, extension); } catch (error) { console.warn("Local document extraction failed, using OCR fallback", error); }
      if (!extracted) extracted = await extractWithDocumentService(file, baseUrl, apiKey);
      parseCache.set(fileHash, { ...extracted, createdAt: Date.now() });
      if (parseCache.size > 30) parseCache.delete(parseCache.keys().next().value!);
    }
    const parseMs = Date.now() - parseStartedAt;
    const sourceText = extracted.text.slice(0, 60_000);
    const chunks: number[] = [];
    for (let remaining = count; remaining > 0; remaining -= 5) chunks.push(Math.min(5, remaining));
    const generated: GeneratedQuestion[] = [];
    const aiStartedAt = Date.now();

    for (let offset = 0; offset < chunks.length; offset += 4) {
      const batch = chunks.slice(offset, offset + 4);
      const results = await Promise.allSettled(batch.map(async (batchCount, batchIndex) => {
        const sequence = offset + batchIndex + 1;
        const prompt = `你是雷鸟产品培训题库专家。请严格依据资料生成 ${batchCount} 道题，不得补充资料中没有的信息。这是第 ${sequence} 批，请优先选择与其他批次不同的知识点。\n\n要求：\n1. 题目分类为“${category}”。\n2. 允许题型：${requestedTypes.join("、")}。single=单选，multi=多选，judge=判断，essay=问答。\n3. 默认难度：${difficulty}，可按内容合理微调。\n4. 单选/多选提供 4 个选项，格式为“A. 内容”；单选答案如“A”，多选答案如“A,C”；判断答案只能为“正确”或“错误”；问答题给出参考答案。\n5. 答案解析和 source 原文依据应准确、简洁。\n6. 避免重复、歧义、主观猜测和“以上都正确”。\n7. 只输出 JSON 对象，格式：{"questions":[{"type":"single","difficulty":"medium","content":"题目","options":["A. 选项"],"answer":"A","score":2,"analysis":"解析","source":"资料原文"}]}\n\n资料内容：\n${sourceText}`;
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.15, max_tokens: Math.max(1400, batchCount * 450), response_format: { type: "json_object" } }),
          signal: AbortSignal.timeout(120_000),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error?.message || data?.message || "AI 生成失败");
        return normalizeQuestions(extractJson(String(data?.choices?.[0]?.message?.content || "")), batchCount);
      }));
      for (const result of results) {
        if (result.status === "fulfilled") generated.push(...result.value);
        else console.warn("AI question batch failed", result.reason);
      }
    }
    const seen = new Set<string>();
    const questions = generated.filter((question) => {
      const key = question.content.replace(/\s+/g, "").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, count);
    if (!questions.length) throw new Error("AI 未生成符合题库格式的题目，请调整设置后重试");
    const aiMs = Date.now() - aiStartedAt;
    const totalMs = Date.now() - totalStartedAt;
    console.info("AI question generation completed", { extension, parseMethod: extracted.method, parseMs, aiMs, totalMs, requested: count, generated: questions.length });

    return NextResponse.json({ success: true, data: { category, questions, sourceFile: file.name, requested: count, timings: { parseMs, aiMs, totalMs, parseMethod: extracted.method } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 生成失败";
    const status = /Unauthorized|Forbidden/.test(message) ? 401 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
