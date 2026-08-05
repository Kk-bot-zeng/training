import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin, getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (user.role === "admin") {
      const tasks = await prisma.learningTask.findMany({
        include: { assignments: { include: { employee: { select: { id: true, name: true, department: { select: { name: true } } } } } } },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ success: true, data: tasks });
    }
    const items = await prisma.learningAssignment.findMany({
      where: { employeeId: user.id }, include: { task: true }, orderBy: { assignedAt: "desc" },
    });
    return NextResponse.json({ success: true, data: items });
  } catch { return NextResponse.json({ success: false, message: "获取学习任务失败" }, { status: 401 }); }
}

export async function POST(request: NextRequest) {
  try {
    await getAuthAdmin();
    const body = await request.json();
    const { title, productLine, description, recording, materials, dueDate, employeeIds } = body;
    if (!title || !productLine || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json({ success: false, message: "请填写任务并至少指定一名员工" }, { status: 400 });
    }
    const task = await prisma.learningTask.create({ data: {
      title, productLine, description: description || null, recording: recording || null,
      materials: JSON.stringify(Array.isArray(materials) ? materials : []), dueDate: dueDate ? new Date(dueDate) : null,
      assignments: { create: employeeIds.map((employeeId: number) => ({ employeeId })) },
    }});
    return NextResponse.json({ success: true, data: task });
  } catch (error) { console.error(error); return NextResponse.json({ success: false, message: "创建学习任务失败" }, { status: 500 }); }
}

export async function PUT(request: NextRequest) {
  try {
    await getAuthAdmin(); const body = await request.json(); const { id, title, productLine, description, recording, materials, dueDate, employeeIds } = body;
    if (!id || !title || !productLine) return NextResponse.json({ success: false, message: "任务信息不完整" }, { status: 400 });
    const task = await prisma.$transaction(async (tx) => {
      await tx.learningAssignment.deleteMany({ where: { taskId: id, employeeId: { notIn: employeeIds || [] } } });
      if (Array.isArray(employeeIds)) for (const employeeId of employeeIds) await tx.learningAssignment.upsert({ where: { taskId_employeeId: { taskId: id, employeeId } }, update: {}, create: { taskId: id, employeeId } });
      return tx.learningTask.update({ where: { id }, data: { title, productLine, description: description || null, recording: recording || null, materials: JSON.stringify(materials || []), dueDate: dueDate ? new Date(dueDate) : null } });
    }); return NextResponse.json({ success: true, data: task });
  } catch { return NextResponse.json({ success: false, message: "更新学习任务失败" }, { status: 500 }); }
}

export async function DELETE(request: NextRequest) {
  try { await getAuthAdmin(); const { ids } = await request.json(); if (!Array.isArray(ids) || !ids.length) return NextResponse.json({ success: false, message: "请选择任务" }, { status: 400 }); await prisma.learningTask.deleteMany({ where: { id: { in: ids } } }); return NextResponse.json({ success: true }); }
  catch { return NextResponse.json({ success: false, message: "删除学习任务失败" }, { status: 500 }); }
}
