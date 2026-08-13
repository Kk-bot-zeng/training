import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

const serialized = (body: Record<string, unknown>) => ({
  groupId: body.groupId ? Number(body.groupId) : null,
  name: String(body.name || "").trim(),
  generationMode: String(body.generationMode || "custom"),
  productModel: body.productModel ? String(body.productModel) : null,
  productMaterial: body.productMaterial ? String(body.productMaterial) : null,
  customerProfile: String(body.customerProfile || ""),
  trainingGoal: String(body.trainingGoal || ""),
  forbiddenRules: body.forbiddenRules ? String(body.forbiddenRules) : null,
  openingMessage: String(body.openingMessage || ""),
  nodes: JSON.stringify(body.nodes || []),
  scoringCriteria: JSON.stringify(body.scoringCriteria || []),
  difficulty: String(body.difficulty || "standard"),
  status: String(body.status || "draft"),
});
export async function GET() {
  try {
    await getAuthAdmin();
    const items = await prisma.scenarioScript.findMany({
      include: { group: true, _count: { select: { tasks: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({
      success: true,
      data: items.map((i) => ({
        ...i,
        nodes: JSON.parse(i.nodes),
        scoringCriteria: JSON.parse(i.scoringCriteria),
      })),
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "获取剧本失败" },
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
        { success: false, message: "请输入剧本名称" },
        { status: 400 },
      );
    return NextResponse.json({
      success: true,
      data: await prisma.scenarioScript.create({ data: serialized(body) }),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: "保存剧本失败" },
      { status: 500 },
    );
  }
}
export async function PUT(request: NextRequest) {
  try {
    await getAuthAdmin();
    const body = await request.json();
    return NextResponse.json({
      success: true,
      data: await prisma.scenarioScript.update({
        where: { id: Number(body.id) },
        data: serialized(body),
      }),
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "更新剧本失败" },
      { status: 500 },
    );
  }
}
export async function DELETE(request: NextRequest) {
  try {
    await getAuthAdmin();
    const { ids } = await request.json();
    const normalized = Array.isArray(ids)
      ? ids.map(Number).filter(Number.isInteger)
      : [];
    if (!normalized.length)
      return NextResponse.json(
        { success: false, message: "请选择要删除的剧本" },
        { status: 400 },
      );
    const result = await prisma.scenarioScript.deleteMany({
      where: { id: { in: normalized } },
    });
    if (!result.count)
      return NextResponse.json(
        { success: false, message: "剧本不存在或已被删除" },
        { status: 404 },
      );
    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error("Delete scenario script error:", error);
    return NextResponse.json(
      { success: false, message: "删除剧本失败，请稍后重试" },
      { status: 500 },
    );
  }
}
