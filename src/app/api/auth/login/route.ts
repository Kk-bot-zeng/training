import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import bcrypt from "bcrypt";

export async function POST(request: NextRequest) {
  try {
    const { username: rawUsername, password, employeeId } = await request.json();
    const username = typeof rawUsername === "string" ? rawUsername.trim() : "";
    if (!username || !password) {
      return NextResponse.json({ success: false, message: "用户名和密码不能为空" }, { status: 400 });
    }

    let token: string;
    let userData: { id: number; name: string; role: string };

    // Run both lookups together to avoid consecutive Neon round trips.
    const [admin, employeeByNo, employeesByName] = await Promise.all([
      prisma.admin.findUnique({ where: { username } }),
      prisma.employee.findUnique({
        where: { employeeNo: username },
        select: { id: true, employeeNo: true, name: true, status: true, passwordHash: true, department: { select: { name: true } } },
      }),
      prisma.employee.findMany({
        where: { name: username },
        select: { id: true, employeeNo: true, name: true, status: true, passwordHash: true, department: { select: { name: true } } },
      }),
    ]);
    if (admin) {
      const valid = await bcrypt.compare(password, admin.passwordHash);
      if (!valid) {
        return NextResponse.json({ success: false, message: "用户名或密码错误" }, { status: 401 });
      }
      token = await signToken({ id: admin.id, username: admin.username, role: "admin" });
      userData = { id: admin.id, name: admin.username, role: "admin" };
    } else {
      let employee = employeeByNo;
      if (!employee && employeesByName.length > 1) {
        const activeCandidates = employeesByName.filter((candidate) => candidate.status === "active" && candidate.passwordHash);
        const passwordMatches = (await Promise.all(activeCandidates.map(async (candidate) =>
          await bcrypt.compare(password, candidate.passwordHash!) ? candidate : null
        ))).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
        if (employeeId != null) {
          employee = passwordMatches.find((candidate) => candidate.id === Number(employeeId)) ?? null;
          if (!employee) {
            return NextResponse.json({ success: false, message: "账号选择已失效，请重新登录" }, { status: 401 });
          }
        } else if (passwordMatches.length > 1) {
          return NextResponse.json({
            success: false,
            code: "ACCOUNT_SELECTION_REQUIRED",
            message: "检测到多个同名账号，请选择所属部门",
            data: {
              candidates: passwordMatches.map((candidate) => ({
                id: candidate.id,
                departmentName: candidate.department.name,
                employeeNo: candidate.employeeNo,
              })),
            },
          }, { status: 409 });
        }
        employee ||= passwordMatches[0];
        if (!employee) {
          return NextResponse.json({ success: false, message: "用户名或密码错误" }, { status: 401 });
        }
      } else if (!employee) {
        employee = employeesByName[0];
      }
      if (!employee || employee.status !== "active" || !employee.passwordHash) {
        return NextResponse.json({ success: false, message: "用户名或密码错误" }, { status: 401 });
      }
      if (employeeByNo || employeesByName.length <= 1) {
        const valid = await bcrypt.compare(password, employee.passwordHash);
        if (!valid) {
          return NextResponse.json({ success: false, message: "用户名或密码错误" }, { status: 401 });
        }
      }
      token = await signToken({ id: employee.id, username: employee.name, role: "employee" });
      userData = { id: employee.id, name: employee.name, role: "employee" };
    }

    const response = NextResponse.json({ success: true, data: userData });
    const secureSetting = process.env.AUTH_COOKIE_SECURE;
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || request.headers.get("host") || request.nextUrl.hostname;
    const secureCookie = secureSetting === "true"
      || (secureSetting !== "false" && (
        forwardedProto === "https"
        || request.nextUrl.protocol === "https:"
        || host.split(":")[0] === "training.kkzlqnb.top"
      ));
    response.cookies.set("token", token, {
      httpOnly: true, secure: secureCookie,
      sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/",
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ success: false, message: "登录失败" }, { status: 500 });
  }
}
