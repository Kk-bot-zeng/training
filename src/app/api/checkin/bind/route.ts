import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { assertCheckinOpen, createDeviceToken, deviceCookie, requestMeta, resolveCheckinAccess } from "@/lib/checkin";

export async function POST(request: NextRequest) {
  try {
    const { qrToken, identifier, password } = await request.json();
    if (!qrToken || !identifier?.trim() || !password) {
      return NextResponse.json({ success: false, message: "请输入姓名或工号和密码" }, { status: 400 });
    }
    const training = await resolveCheckinAccess(qrToken);
    assertCheckinOpen(training);
    const [employeeByNo, employeesByName] = await Promise.all([
      prisma.employee.findFirst({
        where: { employeeNo: identifier.trim(), status: "active" }, include: { department: true },
      }),
      prisma.employee.findMany({
        where: { name: identifier.trim(), status: "active" }, include: { department: true }, take: 2,
      }),
    ]);
    if (!employeeByNo && employeesByName.length > 1) {
      return NextResponse.json({ success: false, message: "存在同名学员，请使用工号绑定" }, { status: 409 });
    }
    const employee = employeeByNo || employeesByName[0];
    if (!employee?.passwordHash || !(await bcrypt.compare(password, employee.passwordHash))) {
      return NextResponse.json({ success: false, message: "姓名/工号或密码错误" }, { status: 401 });
    }
    const departmentIds = JSON.parse(training.departmentIds) as number[];
    if (!departmentIds.includes(employee.departmentId)) {
      return NextResponse.json({ success: false, message: "你不属于本次培训范围" }, { status: 403 });
    }
    const deviceId = randomUUID();
    const expiresAt = new Date(Date.now() + deviceCookie.maxAge * 1000);
    const meta = requestMeta(request);
    await prisma.deviceBinding.upsert({
      where: { employeeId: employee.id },
      update: { deviceId, expiresAt, userAgent: meta.userAgent, lastIp: meta.ip },
      create: { employeeId: employee.id, deviceId, expiresAt, userAgent: meta.userAgent, lastIp: meta.ip },
    });
    const token = await createDeviceToken(employee.id, deviceId);
    const response = NextResponse.json({
      success: true,
      data: { id: employee.id, name: employee.name, employeeNo: employee.employeeNo, departmentName: employee.department.name },
    });
    response.cookies.set(deviceCookie.name, token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      maxAge: deviceCookie.maxAge, path: "/",
    });
    return response;
  } catch (error) {
    console.error("Bind checkin device error:", error);
    return NextResponse.json({ success: false, message: "二维码已失效，请重新扫描" }, { status: 400 });
  }
}
