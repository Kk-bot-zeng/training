import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const normalizedOptions = Array.isArray(body.options)
      ? body.options
      : typeof body.optionsStr === "string"
        ? body.optionsStr.split("|").map((option: string) => option.trim()).filter(Boolean)
        : null;
    if (["single", "multi"].includes(body.type) && (!normalizedOptions || normalizedOptions.length < 2)) {
      return NextResponse.json(
        { success: false, message: "单选题和多选题请至少填写两个选项" },
        { status: 400 }
      );
    }
    const data: Record<string, unknown> = {};
    if (body.type) data.type = body.type;
    if (body.category) data.category = body.category;
    if (body.difficulty) data.difficulty = body.difficulty;
    if (body.content) data.content = body.content;
    if (normalizedOptions !== null) data.options = normalizedOptions.length ? JSON.stringify(normalizedOptions) : null;
    if (body.answer !== undefined) data.answer = body.answer || "";
    if (body.score !== undefined) data.score = body.score;
    if (body.analysis !== undefined) data.analysis = body.analysis;
    const q = await prisma.examQuestion.update({ where: { id: parseInt(id) }, data });
    return NextResponse.json({ success: true, data: q });
  } catch (e) { console.error(e); return NextResponse.json({ success: false, message: "更新失败" }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.examQuestion.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true, message: "删除成功" });
  } catch (e) { console.error(e); return NextResponse.json({ success: false, message: "删除失败" }, { status: 500 }); }
}
