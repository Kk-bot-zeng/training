import { NextRequest, NextResponse } from "next/server";
import { getAuthAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 500);
}

export async function PATCH(request: NextRequest) {
  try {
    await getAuthAdmin();
    const body = await request.json();
    const ids = normalizeIds(body.ids);
    if (!ids.length) return NextResponse.json({ success: false, message: "请选择要编辑的题目" }, { status: 400 });
    const data: { productModel?: string; category?: string; difficulty?: string } = {};
    if (typeof body.productModel === "string" && body.productModel.trim()) data.productModel = body.productModel.trim();
    if (typeof body.category === "string" && body.category.trim()) data.category = body.category.trim();
    if (["easy", "medium", "hard"].includes(body.difficulty)) data.difficulty = body.difficulty;
    if (!Object.keys(data).length) return NextResponse.json({ success: false, message: "请至少选择一个要修改的字段" }, { status: 400 });
    const result = await prisma.examQuestion.updateMany({ where: { id: { in: ids } }, data });
    return NextResponse.json({ success: true, data: { updated: result.count } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "批量编辑失败";
    return NextResponse.json({ success: false, message }, { status: message === "Unauthorized" || message === "Forbidden" ? 403 : 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await getAuthAdmin();
    const ids = normalizeIds((await request.json()).ids);
    if (!ids.length) return NextResponse.json({ success: false, message: "请选择要删除的题目" }, { status: 400 });
    const referenced = await prisma.examPaperQuestion.findMany({
      where: { questionId: { in: ids } }, select: { questionId: true }, distinct: ["questionId"],
    });
    const referencedIds = new Set(referenced.map((item) => item.questionId));
    const deletableIds = ids.filter((id) => !referencedIds.has(id));
    const result = deletableIds.length ? await prisma.examQuestion.deleteMany({ where: { id: { in: deletableIds } } }) : { count: 0 };
    return NextResponse.json({
      success: true,
      data: { deleted: result.count, skipped: referencedIds.size },
      message: referencedIds.size ? `已删除 ${result.count} 道题；${referencedIds.size} 道题正在试卷中使用，已保留` : `已删除 ${result.count} 道题`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "批量删除失败";
    return NextResponse.json({ success: false, message }, { status: message === "Unauthorized" || message === "Forbidden" ? 403 : 500 });
  }
}
