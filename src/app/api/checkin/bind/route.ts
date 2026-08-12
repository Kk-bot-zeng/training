import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { assertCheckinOpen, createDeviceToken, deviceCookie, requestMeta, resolveCheckinAccess, useSecureCheckinCookie } from "@/lib/checkin";

export async function POST(request: NextRequest) {
  try {
    const { qrToken, identifier, password, employeeId } = await request.json();
    if (!qrToken || !identifier?.trim() || !password) {
      return NextResponse.json({ success: false, message: "请输入姓名或工号和密码" }, { status: 400 });
    }
    const training = await resolveCheckinAccess(qrToken, request.headers.get("x-checkin-session"));
    assertCheckinOpen(training);
    const [employeeByNo, employeesByName] = await Promise.all([
      prisma.employee.findFirst({
        where: { employeeNo: identifier.trim(), status: "active" }, include: { department: true },
      }),
      prisma.employee.findMany({
        where: { name: identifier.trim(), status: "active" }, include: { department: true },
      }),
    ]);
    const departmentIds = JSON.parse(training.departmentIds) as number[];
    let employee = employeeByNo;
    if (!employee) {
      const passwordMatches = (await Promise.all(employeesByName.map(async (candidate) =>
        candidate.passwordHash && await bcrypt.compare(password, candidate.passwordHash) ? candidate : null
      ))).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
      const eligibleMatches = passwordMatches.filter((candidate) => departmentIds.includes(candidate.departmentId));
      if (employeeId != null) {
        employee = eligibleMatches.find((candidate) => candidate.id === Number(employeeId)) ?? null;
        if (!employee) {
          return NextResponse.json({ success: false, message: "账号选择已失效，请重新验证" }, { status: 401 });
        }
      } else if (eligibleMatches.length > 1) {
        return NextResponse.json({
          success: false,
          code: "ACCOUNT_SELECTION_REQUIRED",
          message: "检测到多个同名账号，请选择所属部门",
          data: {
            candidates: eligibleMatches.map((candidate) => ({
              id: candidate.id,
              departmentName: candidate.department.name,
              employeeNo: candidate.employeeNo,
            })),
          },
        }, { status: 409 });
      } else {
        employee = eligibleMatches[0] ?? passwordMatches[0] ?? null;
      }
    }
    if (!employee?.passwordHash || (employeeByNo && !(await bcrypt.compare(password, employee.passwordHash)))) {
      return NextResponse.json({ success: false, message: "姓名/工号或密码错误" }, { status: 401 });
    }
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
      httpOnly: true, secure: useSecureCheckinCookie(request), sameSite: "lax",
      maxAge: deviceCookie.maxAge, path: "/",
    });
    return response;
  } catch (error) {
    console.error("Bind checkin device error:", error);
    const code = error instanceof Error ? error.message : "";
    if (code === "QR_EXPIRED") {
      return NextResponse.json({ success: false, message: "二维码已失效，请重新扫描" }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: "设备绑定失败，请联系管理员" }, { status: 500 });
  }
}
