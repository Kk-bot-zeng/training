import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
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
        select: { id: true, employeeNo: true, name: true, status: true, passwordHash: true },
      }),
      prisma.employee.findMany({
        where: { name: username },
        select: { id: true, employeeNo: true, name: true, status: true, passwordHash: true },
        take: 2,
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
      if (!employeeByNo && employeesByName.length > 1) {
        return NextResponse.json({ success: false, message: "存在同名学员，请使用工号登录" }, { status: 409 });
      }
      const employee = employeeByNo || employeesByName[0];
      if (!employee || employee.status !== "active" || !employee.passwordHash) {
        return NextResponse.json({ success: false, message: "用户名或密码错误" }, { status: 401 });
      }
      const valid = await bcrypt.compare(password, employee.passwordHash);
      if (!valid) {
        return NextResponse.json({ success: false, message: "用户名或密码错误" }, { status: 401 });
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
