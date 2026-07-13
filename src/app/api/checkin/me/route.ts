import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertCheckinOpen, getBoundDevice, resolveCheckinAccess } from "@/lib/checkin";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("qrToken");
    if (!token) return NextResponse.json({ success: false, message: "参数错误" }, { status: 400 });
    const [training, binding] = await Promise.all([resolveCheckinAccess(token), getBoundDevice()]);
    assertCheckinOpen(training);
    const departmentIds = JSON.parse(training.departmentIds) as number[];
    if (!departmentIds.includes(binding.employee.departmentId)) {
      return NextResponse.json({ success: false, message: "你不属于本次培训范围" }, { status: 403 });
    }
    const attendance = await prisma.attendance.findUnique({
      where: { trainingId_employeeId: { trainingId: training.id, employeeId: binding.employeeId } },
    });
    return NextResponse.json({
      success: true,
      data: {
        id: binding.employee.id, name: binding.employee.name, employeeNo: binding.employee.employeeNo,
        departmentName: binding.employee.department.name, checkedIn: Boolean(attendance),
        status: attendance?.status || null, checkInTime: attendance?.checkInTime || null,
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "DEVICE_BIND_REQUIRED") {
      return NextResponse.json({ success: false, code, message: "请先绑定当前手机" }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: "二维码已失效，请重新扫描" }, { status: 400 });
  }
}
