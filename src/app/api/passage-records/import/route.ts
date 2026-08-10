import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

const allowed = ["pending", "passed", "failed", "leave"];
export async function POST(request: NextRequest) {
  try {
    await getAuthAdmin();
    const { sessionId, rows } = await request.json();
    const session = await prisma.passageSession.findUnique({ where: { id: Number(sessionId) } });
    if (!session || new Date() > session.endTime) return NextResponse.json({ success: false, message: "场次不存在或已截止" }, { status: 400 });
    if (!Array.isArray(rows) || !rows.length) return NextResponse.json({ success: false, message: "导入内容为空" }, { status: 400 });
    const employees = await prisma.employee.findMany({ where: { status: "active" }, include: { department: true } });
    let updated = 0; const errors: string[] = [];
    for (const [index, row] of rows.entries()) {
      const no = String(row["工号"] || "").trim(); const name = String(row["员工"] || row["姓名"] || "").trim(); const department = String(row["部门"] || "").trim();
      const status = ({ "待过堂": "pending", "通过": "passed", "未通过": "failed", "请假": "leave" } as Record<string, string>)[String(row["过堂情况"] || "").trim()] || String(row["过堂情况"] || "").trim();
      const employee = no ? employees.find(item => item.employeeNo === no) : employees.find(item => item.name === name && item.department.name === department);
      if (!name || !department || !employee || (status && !allowed.includes(status))) { errors.push(String(index + 2)); continue; }
      const existing = await prisma.passageRecord.findFirst({ where: { sessionId: session.id, employeeId: employee.id } });
      const data = { status: status || "pending", remark: String(row["备注"] || "").trim() || null };
      if (existing) await prisma.passageRecord.update({ where: { id: existing.id }, data }); else await prisma.passageRecord.create({ data: { ...data, sessionId: session.id, employeeId: employee.id, recordDate: session.startTime } });
      updated++;
    }
    return NextResponse.json({ success: true, data: { updated, errors } });
  } catch { return NextResponse.json({ success: false, message: "导入过堂记录失败" }, { status: 500 }); }
}
