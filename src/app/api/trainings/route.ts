import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const departmentId = searchParams.get("departmentId");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [trainings, total] = await Promise.all([
      prisma.training.findMany({
        where,
        include: { _count: { select: { attendance: true } } },
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.training.count({ where }),
    ]);

    // Filter by departmentId in app code (stored as JSON string)
    let filtered = trainings;
    if (departmentId) {
      const deptId = parseInt(departmentId);
      filtered = trainings.filter((t) => {
        const ids = JSON.parse(t.departmentIds) as number[];
        return ids.includes(deptId);
      });
    }

    return NextResponse.json({
      success: true,
      data: { items: filtered, total },
    });
  } catch (error) {
    console.error("Get trainings error:", error);
    return NextResponse.json(
      { success: false, message: "获取培训列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, type, date, startTime, endTime, location, departmentIds } = body;

    if (!title?.trim() || !date || !startTime || !endTime || !departmentIds?.length) {
      return NextResponse.json(
        { success: false, message: "标题、日期、时间和部门不能为空" },
        { status: 400 }
      );
    }

    const qrToken = randomUUID();
    const training = await prisma.training.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        type: type || "training",
        date: new Date(date),
        startTime,
        endTime,
        location: location?.trim() || null,
        departmentIds: JSON.stringify(departmentIds),
        qrToken,
        status: "upcoming",
      },
    });

    const checkinUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/checkin/${qrToken}`;

    return NextResponse.json({
      success: true,
      data: { ...training, checkinUrl },
    });
  } catch (error) {
    console.error("Create training error:", error);
    return NextResponse.json(
      { success: false, message: "创建培训失败" },
      { status: 500 }
    );
  }
}
