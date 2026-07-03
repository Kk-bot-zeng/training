import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const paper = await prisma.examPaper.findUnique({
      where: { id: parseInt(id) },
      include: {
        paperQuestions: { include: { question: true }, orderBy: { order: "asc" } },
        _count: { select: { attempts: true } },
      },
    });
    if (!paper) return NextResponse.json({ success: false, message: "试卷不存在" }, { status: 404 });
    return NextResponse.json({ success: true, data: paper });
  } catch (e) { console.error(e); return NextResponse.json({ success: false, message: "获取失败" }, { status: 500 }); }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    const fields = ["title","description","type","duration","passScore","totalScore","status","shuffleQuestions","shuffleOptions","maxSwitch","allowRetake","retakeCount"];
    for (const f of fields) if (body[f] !== undefined) data[f] = body[f];
    if (body.startTime) data.startTime = new Date(body.startTime);
    if (body.endTime) data.endTime = new Date(body.endTime);

    const paper = await prisma.examPaper.update({ where: { id: parseInt(id) }, data });
    return NextResponse.json({ success: true, data: paper });
  } catch (e) { console.error(e); return NextResponse.json({ success: false, message: "更新失败" }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.examPaper.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true, message: "删除成功" });
  } catch (e) { console.error(e); return NextResponse.json({ success: false, message: "删除失败" }, { status: 500 }); }
}
