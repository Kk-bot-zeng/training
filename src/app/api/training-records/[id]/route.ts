import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const record = await prisma.trainingRecord.update({
      where: { id: parseInt(id) },
      data: {
        ...(body.topic && { topic: body.topic }),
        ...(body.target && { target: body.target }),
        ...(body.date && { date: new Date(body.date) }),
        ...(body.initiator && { initiator: body.initiator }),
        ...(body.format && { format: body.format }),
        ...(body.participantCount !== undefined && { participantCount: body.participantCount }),
        ...(body.instructor !== undefined && { instructor: body.instructor }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.status && { status: body.status }),
        ...(body.materials !== undefined && { materials: typeof body.materials === "string" ? body.materials : JSON.stringify(body.materials) }),
        ...(body.recording !== undefined && { recording: body.recording }),
      },
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error("Update training record error:", error);
    return NextResponse.json({ success: false, message: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.trainingRecord.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true, message: "删除成功" });
  } catch (error) {
    console.error("Delete training record error:", error);
    return NextResponse.json({ success: false, message: "删除失败" }, { status: 500 });
  }
}
