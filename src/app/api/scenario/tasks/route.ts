import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin, getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (user.role === "admin") {
      const items = await prisma.scenarioTask.findMany({
        include: {
          script: { select: { id: true, name: true, difficulty: true } },
          assignments: {
            include: {
              employee: {
                select: {
                  id: true,
                  name: true,
                  department: { select: { name: true } },
                },
              },
            },
          },
          sessions: {
            select: {
              id: true,
              status: true,
              score: true,
              employeeId: true,
              attemptNo: true,
              submittedAt: true,
              updatedAt: true,
              employee: {
                select: {
                  name: true,
                  department: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ success: true, data: items });
    }
    const assignments = await prisma.scenarioAssignment.findMany({
      where: { employeeId: user.id },
      include: {
        task: {
          include: {
            script: {
              select: {
                id: true,
                name: true,
                difficulty: true,
                openingMessage: true,
              },
            },
            sessions: {
              where: { employeeId: user.id },
              select: {
                id: true,
                status: true,
                score: true,
                attemptNo: true,
                updatedAt: true,
              },
            },
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });
    return NextResponse.json({
      success: true,
      data: assignments.map((a) => a.task),
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "获取演练任务失败" },
      { status: 401 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await getAuthAdmin();
    const body = await request.json();
    const employeeIds = [
      ...new Set((body.employeeIds || []).map(Number)),
    ] as number[];
    if (!body.name?.trim() || !body.scriptId || !employeeIds.length)
      return NextResponse.json(
        { success: false, message: "请填写任务并指定学员" },
        { status: 400 },
      );
    const task = await prisma.scenarioTask.create({
      data: {
        scriptId: Number(body.scriptId),
        name: body.name.trim(),
        startTime: body.startTime ? new Date(body.startTime) : null,
        endTime: body.endTime ? new Date(body.endTime) : null,
        durationMinutes: Number(body.durationMinutes) || 30,
        maxAttempts: Number(body.maxAttempts) || 1,
        passScore: Number(body.passScore) || 60,
        allowHints: body.allowHints !== false,
        status: body.status || "published",
        assignments: {
          create: employeeIds.map((employeeId) => ({ employeeId })),
        },
      },
    });
    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: "创建任务失败" },
      { status: 500 },
    );
  }
}
export async function PUT(request: NextRequest) {
  try {
    await getAuthAdmin();
    const body = await request.json();
    const id = Number(body.id);
    const employeeIds = [
      ...new Set((body.employeeIds || []).map(Number)),
    ].filter(Boolean) as number[];
    if (!id || !body.name?.trim() || !body.scriptId || !employeeIds.length)
      return NextResponse.json(
        { success: false, message: "请填写任务并指定学员" },
        { status: 400 },
      );
    const task = await prisma.$transaction(async (tx) => {
      const updated = await tx.scenarioTask.update({
        where: { id },
        data: {
          scriptId: Number(body.scriptId),
          name: body.name.trim(),
          startTime: body.startTime ? new Date(body.startTime) : null,
          endTime: body.endTime ? new Date(body.endTime) : null,
          durationMinutes: Number(body.durationMinutes) || 30,
          maxAttempts: Number(body.maxAttempts) || 1,
          passScore: Number(body.passScore) || 60,
          allowHints: body.allowHints !== false,
          status: "published",
        },
      });
      await tx.scenarioAssignment.deleteMany({
        where: { taskId: id, employeeId: { notIn: employeeIds } },
      });
      await tx.scenarioAssignment.createMany({
        data: employeeIds.map((employeeId) => ({ taskId: id, employeeId })),
        skipDuplicates: true,
      });
      return updated;
    });
    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: "更新并重新发布任务失败" },
      { status: 500 },
    );
  }
}
export async function DELETE(request: NextRequest) {
  try {
    await getAuthAdmin();
    const { ids } = await request.json();
    await prisma.scenarioTask.deleteMany({
      where: { id: { in: ids.map(Number) } },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, message: "删除任务失败" },
      { status: 500 },
    );
  }
}
