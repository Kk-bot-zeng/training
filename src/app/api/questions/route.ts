import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";
import { inferQuestionModel, questionSearchText } from "@/lib/question-model";

export async function GET(request: NextRequest) {
  try {
    await getAuthAdmin();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const type = searchParams.get("type");
    const difficulty = searchParams.get("difficulty");
    const productModel = searchParams.get("productModel");
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (type) where.type = type;
    if (difficulty) where.difficulty = difficulty;
    if (productModel) where.productModel = productModel;
    if (search) where.content = { contains: search };

    const [questions, total, models] = await Promise.all([
      prisma.examQuestion.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.examQuestion.count({ where }),
      prisma.examQuestion.findMany({ distinct: ["productModel"], select: { productModel: true }, orderBy: { productModel: "asc" } }),
    ]);

    return NextResponse.json({ success: true, data: { items: questions, total, models: models.map((item) => item.productModel) } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, message: "获取题库失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await getAuthAdmin();
    const body = await request.json();
    const { type, category, difficulty, content, options, optionsStr, answer, score, analysis } = body;
    if (!type || !content || (type !== "essay" && !answer)) {
      return NextResponse.json({ success: false, message: "题型、题目和客观题答案不能为空" }, { status: 400 });
    }
    const normalizedOptions = Array.isArray(options)
      ? options
      : typeof optionsStr === "string"
        ? optionsStr.split("|").map((option: string) => option.trim()).filter(Boolean)
        : [];
    if (["single", "multi"].includes(type) && normalizedOptions.length < 2) {
      return NextResponse.json(
        { success: false, message: "单选题和多选题请至少填写两个选项" },
        { status: 400 }
      );
    }
    const models = await prisma.examQuestion.findMany({ distinct: ["productModel"], select: { productModel: true } });
    const detectedModel = String(body.productModel || category || "通用").trim() || "通用";
    const q = await prisma.examQuestion.create({
      data: {
        type, productModel: detectedModel, category: detectedModel, difficulty: difficulty || "medium",
        content, options: normalizedOptions.length ? JSON.stringify(normalizedOptions) : null,
        answer: answer || "", score: score || 2, analysis: analysis || null,
      },
    });
    return NextResponse.json({ success: true, data: q });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, message: "创建题目失败" }, { status: 500 });
  }
}
