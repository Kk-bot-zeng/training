import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getAuthAdmin();
    const { id } = await params;
    const { title, description, dueDate, status } = await request.json();
    const assignment = await prisma.assignment.update({
      where: { id: Number(id) },
      data: {
        title: title?.trim(),
        description: description?.trim() || null,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        status,
      },
    });
    return NextResponse.json({ success: true, data: assignment });
  } catch (error) {
    console.error("Update assignment error:", error);
    return NextResponse.json({ success: false, message: "更新作业失败" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getAuthAdmin();
    const { id } = await params;
    await prisma.assignment.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete assignment error:", error);
    return NextResponse.json({ success: false, message: "删除作业失败" }, { status: 500 });
  }
}
