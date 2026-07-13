import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertCheckinOpen, getBoundDevice, requestMeta, resolveCheckinAccess } from "@/lib/checkin";

export async function POST(request: NextRequest) {
  try {
    const { qrToken } = await request.json();
    if (!qrToken) return NextResponse.json({ success: false, message: "参数错误" }, { status: 400 });
    const [training, binding] = await Promise.all([resolveCheckinAccess(qrToken), getBoundDevice()]);
    const window = assertCheckinOpen(training);
    const employee = binding.employee;
    const departmentIds = JSON.parse(training.departmentIds) as number[];
    if (!departmentIds.includes(employee.departmentId)) {
      return NextResponse.json({ success: false, message: "你不属于本次培训范围" }, { status: 403 });
    }
    const existing = await prisma.attendance.findUnique({
      where: { trainingId_employeeId: { trainingId: training.id, employeeId: employee.id } },
    });
    if (existing) {
      return NextResponse.json({
        success: true, message: "你已完成签到",
        data: { employeeName: employee.name, checkInTime: existing.checkInTime, status: existing.status },
      });
    }
    const now = new Date();
    const status = now > window.lateAt ? "late" : "present";
    const meta = requestMeta(request);
    const record = await prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.create({
        data: { trainingId: training.id, employeeId: employee.id, status, checkInTime: now },
      });
      await tx.checkinAudit.create({
        data: { trainingId: training.id, employeeId: employee.id, deviceId: binding.deviceId, ip: meta.ip, userAgent: meta.userAgent, result: status },
      });
      await tx.deviceBinding.update({
        where: { id: binding.id }, data: { lastIp: meta.ip, userAgent: meta.userAgent },
      });
      return attendance;
    });
    return NextResponse.json({
      success: true, message: `签到成功（${status === "present" ? "出席" : "迟到"}）`,
      data: { employeeName: employee.name, checkInTime: record.checkInTime, status: record.status },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      DEVICE_BIND_REQUIRED: "设备绑定已失效，请重新绑定",
      QR_EXPIRED: "二维码已更新，请重新扫描",
      CHECKIN_NOT_OPEN: "签到尚未开始",
      CHECKIN_CLOSED: "签到已截止，请联系管理员补签",
      TRAINING_ENDED: "培训已结束",
    };
    console.error("Submit checkin error:", error);
    return NextResponse.json({ success: false, message: messages[code] || "签到失败" }, { status: 400 });
  }
}
