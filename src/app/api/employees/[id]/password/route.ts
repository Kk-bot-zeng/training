import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { password } = await request.json();
    if (!password || password.length < 4) {
      return NextResponse.json({ success: false, message: "密码至少4位" }, { status: 400 });
    }
    const hash = await bcrypt.hash(password, 10);
    await prisma.employee.update({ where: { id: parseInt(id) }, data: { passwordHash: hash } });
    return NextResponse.json({ success: true, message: "密码设置成功" });
  } catch (e) { console.error(e); return NextResponse.json({ success: false, message: "操作失败" }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.employee.update({ where: { id: parseInt(id) }, data: { passwordHash: null } });
    return NextResponse.json({ success: true, message: "密码已清除，该员工无法登录" });
  } catch (e) { console.error(e); return NextResponse.json({ success: false, message: "操作失败" }, { status: 500 }); }
}
