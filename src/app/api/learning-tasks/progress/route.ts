import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (user.role !== "employee") return NextResponse.json({ success: false }, { status: 403 });
    const { assignmentId, videoSeconds, videoDuration, viewedFile } = await request.json();
    const assignment = await prisma.learningAssignment.findFirst({ where: { id: assignmentId, employeeId: user.id }, include: { task: true } });
    if (!assignment) return NextResponse.json({ success: false, message: "任务不存在" }, { status: 404 });
    const files = new Set<string>(JSON.parse(assignment.viewedFiles));
    if (viewedFile) files.add(viewedFile);
    const watched = Math.max(assignment.videoSeconds, Math.min(Number(videoSeconds) || 0, Number(videoDuration) || assignment.videoDuration || 0));
    const duration = Math.max(assignment.videoDuration, Number(videoDuration) || 0);
    const materials = JSON.parse(assignment.task.materials || "[]") as { url?: string; required?: boolean }[];
    const required = materials.filter(m => m.required !== false && m.url).map(m => m.url as string);
    const videoDone = !assignment.task.recording || (duration > 0 && watched / duration >= 0.9);
    const filesDone = required.every(url => files.has(url));
    const completedAt = videoDone && filesDone ? assignment.completedAt || new Date() : null;
    const data = await prisma.learningAssignment.update({ where: { id: assignment.id }, data: { videoSeconds: watched, videoDuration: duration, viewedFiles: JSON.stringify([...files]), lastStudiedAt: new Date(), completedAt } });
    return NextResponse.json({ success: true, data });
  } catch { return NextResponse.json({ success: false, message: "保存学习进度失败" }, { status: 500 }); }
}
