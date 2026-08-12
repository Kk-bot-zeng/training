import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (user.role !== "employee") throw new Error("Forbidden");
    const { taskId } = await request.json();
    const task = await prisma.scenarioTask.findFirst({
      where: { id: Number(taskId), status: "published", assignments: { some: { employeeId: user.id } } },
      include: {
        script: true,
        sessions: { where: { employeeId: user.id }, orderBy: { attemptNo: "desc" }, take: 1 },
      },
    });
    if (!task) return NextResponse.json({ success: false, message: "任务不存在或无权限" }, { status: 404 });
    const now = new Date();
    if (task.startTime && now < task.startTime) return NextResponse.json({ success: false, message: "任务尚未开始" }, { status: 400 });
    if (task.endTime && now > task.endTime) return NextResponse.json({ success: false, message: "任务已结束" }, { status: 400 });
    const existing = task.sessions[0];
    if (existing?.status === "in_progress") return NextResponse.json({ success: true, data: { sessionId: existing.id } });
    const attemptNo = (existing?.attemptNo || 0) + 1;
    if (attemptNo > task.maxAttempts) return NextResponse.json({ success: false, message: "已达到最大演练次数" }, { status: 400 });
    const messages = [{ role: "assistant", content: task.script.openingMessage, time: new Date().toISOString() }];
    const session = await prisma.scenarioSession.create({
      data: { taskId: task.id, employeeId: user.id, attemptNo, messages: JSON.stringify(messages) },
    });
    return NextResponse.json({ success: true, data: { sessionId: session.id } });
  } catch {
    return NextResponse.json({ success: false, message: "开始演练失败" }, { status: 500 });
  }
}
