import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin, getAuthUser } from "@/lib/auth";
import { normalizeTrainingMaterials, validResourceUrl } from "@/lib/training-materials";

function normalizeRecord<T extends { id: number; materials: string | null; recording: string | null }>(record: T, protect = false) {
  let materials = normalizeTrainingMaterials(record.materials);
  if (protect) materials = materials.map((item, index) => ({
    name: item.name, type: item.type,
    url: `/api/learning-files/view?scope=training&id=${record.id}&kind=material&index=${index}`,
  }));
  const cleanRecording = validResourceUrl(record.recording);
  const hasRecording = Boolean(cleanRecording);
  const recording = hasRecording
    ? (protect ? `/api/learning-files/view?scope=training&id=${record.id}&kind=recording` : record.recording!.trim())
    : null;
  return { ...record, materials: materials.length ? JSON.stringify(materials) : null, recording };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
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

    return NextResponse.json({ success: true, data: { items: records.map((record) => normalizeRecord(record, user.role === "employee")), total } });
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
        materials: normalizeTrainingMaterials(materials).length ? JSON.stringify(normalizeTrainingMaterials(materials)) : null,
        recording: validResourceUrl(recording),
      },
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error("Create training record error:", error);
    return NextResponse.json({ success: false, message: "创建培训档案失败" }, { status: 500 });
  }
}
