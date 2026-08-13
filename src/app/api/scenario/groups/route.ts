import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await getAuthAdmin();
    return NextResponse.json({
      success: true,
      data: await prisma.scenarioGroup.findMany({
        include: { _count: { select: { scripts: true } } },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "获取分组失败" },
      { status: 401 },
    );
  }
}
export async function POST(request: NextRequest) {
  try {
    await getAuthAdmin();
    const body = await request.json();
    if (!body.name?.trim())
      return NextResponse.json(
        { success: false, message: "请输入分组名称" },
        { status: 400 },
      );
    const item = await prisma.scenarioGroup.create({
      data: {
        name: body.name.trim(),
        parentId: body.parentId ? Number(body.parentId) : null,
      },
    });
    return NextResponse.json({ success: true, data: item });
  } catch {
    return NextResponse.json(
      { success: false, message: "创建分组失败" },
      { status: 500 },
    );
  }
}
export async function PUT(request: NextRequest) {
  try {
    await getAuthAdmin();
    const body = await request.json();
    const item = await prisma.scenarioGroup.update({
      where: { id: Number(body.id) },
      data: {
        name: body.name.trim(),
        parentId: body.parentId ? Number(body.parentId) : null,
        sortOrder: Number(body.sortOrder) || 0,
      },
    });
    return NextResponse.json({ success: true, data: item });
  } catch {
    return NextResponse.json(
      { success: false, message: "更新分组失败" },
      { status: 500 },
    );
  }
}
export async function DELETE(request: NextRequest) {
  try {
    await getAuthAdmin();
    const { id } = await request.json();
    const groupId = Number(id);
    if (!Number.isInteger(groupId))
      return NextResponse.json(
        { success: false, message: "请选择要删除的分组" },
        { status: 400 },
      );
    const result = await prisma.$transaction(async (tx) => {
      const ungrouped = await tx.scenarioScript.updateMany({
        where: { groupId },
        data: { groupId: null },
      });
      await tx.scenarioGroup.delete({ where: { id: groupId } });
      return ungrouped.count;
    });
    return NextResponse.json({ success: true, ungroupedCount: result });
  } catch (error) {
    console.error("Delete scenario group error:", error);
    return NextResponse.json(
      { success: false, message: "删除分组失败，请稍后重试" },
      { status: 400 },
    );
  }
}
