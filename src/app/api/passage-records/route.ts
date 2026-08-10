import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

export async function GET(request: NextRequest) {
  try {
    await getAuthAdmin();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const departmentId = Number(searchParams.get("departmentId")) || undefined;
    if (!date) return NextResponse.json({ success: false, message: "请选择日期" }, { status: 400 });
    const employees = await prisma.employee.findMany({
      where: { status: "active", ...(departmentId ? { departmentId } : {}) },
      include: { department: { select: { name: true } }, passageRecords: { where: { recordDate: toDate(date) } } },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
    });
    return NextResponse.json({ success: true, data: employees.map(({ passageRecords, ...employee }) => ({ ...employee, record: passageRecords[0] || null })) });
  } catch { return NextResponse.json({ success: false, message: "获取过堂记录失败" }, { status: 500 }); }
}

export async function PUT(request: NextRequest) {
  try {
    await getAuthAdmin();
    const { date, employeeId, status, remark } = await request.json();
    if (!date || !employeeId || !["pending", "passed", "failed", "leave"].includes(status)) return NextResponse.json({ success: false, message: "记录参数无效" }, { status: 400 });
    const recordDate = toDate(date);
    const record = await prisma.passageRecord.upsert({
      where: { employeeId_recordDate: { employeeId: Number(employeeId), recordDate } },
      update: { status, remark: remark?.trim() || null },
      create: { employeeId: Number(employeeId), recordDate, status, remark: remark?.trim() || null },
    });
    return NextResponse.json({ success: true, data: record });
  } catch { return NextResponse.json({ success: false, message: "保存过堂记录失败" }, { status: 500 }); }
}
