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
    const [admin, employee] = await Promise.all([
      prisma.admin.findUnique({ where: { username } }),
      prisma.employee.findUnique({
        where: { employeeNo: username },
        select: { id: true, name: true, status: true, passwordHash: true },
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
    response.cookies.set("token", token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/",
    });
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ success: false, message: "登录失败" }, { status: 500 });
  }
}
