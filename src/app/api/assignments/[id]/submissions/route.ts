import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin, getAuthUser } from "@/lib/auth";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getAuthAdmin();
    const { id } = await params;
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: Number(id) },
      include: { employee: { include: { department: true } } },
      orderBy: { submittedAt: "desc" },
    });
    return NextResponse.json({ success: true, data: submissions });
  } catch (error) {
    console.error("Get submissions error:", error);
    return NextResponse.json({ success: false, message: "获取提交记录失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (user.role !== "employee") throw new Error("Forbidden");
    const { id } = await params;
    const assignmentId = Number(id);
    const { files, comment } = await request.json();
    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ success: false, message: "请至少上传一个作业文件" }, { status: 400 });
    }
    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment || assignment.status !== "published") {
      return NextResponse.json({ success: false, message: "该作业不可提交" }, { status: 400 });
    }
    if (assignment.dueDate.getTime() < Date.now()) {
      return NextResponse.json({ success: false, message: "已超过作业截止时间" }, { status: 400 });
    }
    const data = {
      files: JSON.stringify(files),
      comment: comment?.trim() || null,
      submittedAt: new Date(),
    };
    const submission = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_employeeId: { assignmentId, employeeId: user.id } },
      update: data,
      create: { assignmentId, employeeId: user.id, ...data },
    });
    return NextResponse.json({ success: true, data: submission });
  } catch (error) {
    console.error("Submit assignment error:", error);
    return NextResponse.json({ success: false, message: "提交作业失败" }, { status: 500 });
  }
}
