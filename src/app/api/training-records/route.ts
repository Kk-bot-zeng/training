import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin, getAuthUser } from "@/lib/auth";

function normalizeRecord<T extends { materials: string | null; recording: string | null }>(record: T) {
  let materials: { name?: string; url?: string; type?: string }[] = [];
  try {
    const parsed = JSON.parse(record.materials || "[]");
    if (Array.isArray(parsed)) materials = parsed.filter((item) => item && typeof item.url === "string" && item.url.trim());
  } catch {}
  const recording = typeof record.recording === "string" && record.recording.trim() ? record.recording.trim() : null;
  return { ...record, materials: materials.length ? JSON.stringify(materials) : null, recording };
}

export async function GET(request: NextRequest) {
  try {
    await getAuthUser();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const format = searchParams.get("format");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (format) where.format = format;
    if (search) {
      where.OR = [
        { topic: { contains: search } },
        { initiator: { contains: search } },
        { instructor: { contains: search } },
        { target: { contains: search } },
      ];
    }

    const [records, total] = await Promise.all([
      prisma.trainingRecord.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.trainingRecord.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: { items: records.map(normalizeRecord), total } });
  } catch (error) {
    console.error("Get training records error:", error);
    return NextResponse.json({ success: false, message: "获取培训档案失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await getAuthAdmin();
    const body = await request.json();
    const { topic, target, date, initiator, format, participantCount, instructor, description, status, materials, recording } = body;

    if (!topic || !target || !date || !initiator) {
      return NextResponse.json({ success: false, message: "培训主题、对象、时间和发起人不能为空" }, { status: 400 });
    }

    const record = await prisma.trainingRecord.create({
      data: {
        topic, target, date: new Date(date), initiator,
        format: format || "offline",
        participantCount: participantCount || 0,
        instructor: instructor || null,
        description: description || null,
        status: status || "completed",
        materials: materials ? JSON.stringify(materials) : null,
        recording: recording || null,
      },
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error("Create training record error:", error);
    return NextResponse.json({ success: false, message: "创建培训档案失败" }, { status: 500 });
  }
}
