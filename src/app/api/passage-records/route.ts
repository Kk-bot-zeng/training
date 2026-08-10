import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

export async function GET(request: NextRequest) {
  try {
    await getAuthAdmin();
    const { searchParams } = new URL(request.url);
    const sessionId = Number(searchParams.get("sessionId"));
    const departmentId = Number(searchParams.get("departmentId")) || undefined;
    if (!sessionId) return NextResponse.json({ success: false, message: "请选择过堂场次" }, { status: 400 });
    const session = await prisma.passageSession.findUnique({ where: { id: sessionId } });
    if (!session) return NextResponse.json({ success: false, message: "过堂场次不存在" }, { status: 404 });
    const targetDepartments = JSON.parse(session.departmentIds || "[]") as number[];
    const employees = await prisma.employee.findMany({
      where: { status: "active", ...(departmentId ? { departmentId } : targetDepartments.length ? { departmentId: { in: targetDepartments } } : {}) },
      include: { department: { select: { name: true } }, passageRecords: { where: { sessionId } } },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
    });
    return NextResponse.json({ success: true, data: employees.map(({ passageRecords, ...employee }) => ({ ...employee, record: passageRecords[0] || null })), session });
  } catch { return NextResponse.json({ success: false, message: "获取过堂记录失败" }, { status: 500 }); }
}

export async function PUT(request: NextRequest) {
  try {
    await getAuthAdmin();
    const { sessionId, employeeId, status, remark } = await request.json();
    if (!sessionId || !employeeId || !["pending", "passed", "failed", "leave"].includes(status)) return NextResponse.json({ success: false, message: "记录参数无效" }, { status: 400 });
    const session = await prisma.passageSession.findUnique({ where: { id: Number(sessionId) } });
    if (!session || new Date() > session.endTime) return NextResponse.json({ success: false, message: "该场次已截止，不能继续记录" }, { status: 400 });
    const existing = await prisma.passageRecord.findFirst({ where: { sessionId: Number(sessionId), employeeId: Number(employeeId) } });
    const record = existing ? await prisma.passageRecord.update({ where: { id: existing.id }, data: { status, remark: remark?.trim() || null } }) : await prisma.passageRecord.create({ data: { sessionId: Number(sessionId), employeeId: Number(employeeId), recordDate: session.startTime, status, remark: remark?.trim() || null } });
    return NextResponse.json({ success: true, data: record });
  } catch { return NextResponse.json({ success: false, message: "保存过堂记录失败" }, { status: 500 }); }
}
