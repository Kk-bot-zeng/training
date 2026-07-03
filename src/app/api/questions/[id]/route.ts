import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.type) data.type = body.type;
    if (body.category) data.category = body.category;
    if (body.difficulty) data.difficulty = body.difficulty;
    if (body.content) data.content = body.content;
    if (body.options !== undefined) data.options = typeof body.options === "string" ? body.options : JSON.stringify(body.options);
    if (body.answer) data.answer = body.answer;
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
