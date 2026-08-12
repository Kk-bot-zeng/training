import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin, getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    const status = request.nextUrl.searchParams.get("status");
    const where = user.role === "admin"
      ? (status ? { status } : {})
      : { employeeId: user.id };
    const items = await prisma.catcherQuestion.findMany({
      where,
      include: { employee: { select: { id: true, name: true, employeeNo: true, department: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: items });
  } catch {
    return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    const body = await request.json();
    if (!body.question?.trim()) return NextResponse.json({ success: false, message: "请输入问题" }, { status: 400 });
    let employee = null;
    if (user.role === "employee") {
      employee = await prisma.employee.findUnique({ where: { id: user.id }, include: { department: true } });
      if (!employee) return NextResponse.json({ success: false, message: "学员不存在" }, { status: 404 });
    } else {
      await getAuthAdmin();
    }
    const answer = body.answer?.trim() || null;
    const item = await prisma.catcherQuestion.create({ data: {
      employeeId: employee?.id || null,
      submitterName: employee?.name || "管理员",
      departmentName: employee?.department.name || null,
      productModel: body.productModel?.trim() || null,
      category: body.category?.trim() || null,
      question: body.question.trim(),
      answer,
      status: answer ? "answered" : "pending",
      source: user.role === "admin" ? (body.source === "talking_point" ? "talking_point" : "admin") : "employee",
    }});
    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error("Create catcher question error:", error);
    return NextResponse.json({ success: false, message: "提交失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await getAuthAdmin();
    const body = await request.json();
    const id = Number(body.id);
    if (!id || !body.question?.trim()) return NextResponse.json({ success: false, message: "参数错误" }, { status: 400 });
    const answer = body.answer?.trim() || null;
    const item = await prisma.catcherQuestion.update({ where: { id }, data: {
      question: body.question.trim(), answer,
      productModel: body.productModel?.trim() || null,
      category: body.category?.trim() || null,
      status: body.status || (answer ? "answered" : "pending"),
      source: body.source === "talking_point" ? "talking_point" : "admin",
    }});
    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error("Update catcher question error:", error);
    return NextResponse.json({ success: false, message: "保存失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await getAuthAdmin();
    const body = await request.json();
    const ids = (Array.isArray(body.ids) ? body.ids : [body.id]).map(Number).filter(Boolean);
    await prisma.catcherQuestion.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "删除失败" }, { status: 500 });
  }
}
