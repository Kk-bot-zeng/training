import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

export async function GET() { try { await getAuthAdmin(); const data = await prisma.passageSession.findMany({ orderBy: { startTime: "desc" } }); return NextResponse.json({ success: true, data }); } catch { return NextResponse.json({ success: false }, { status: 500 }); } }
export async function POST(request: NextRequest) { try { await getAuthAdmin(); const { title, startTime, endTime, departmentIds } = await request.json(); if (!title?.trim() || !startTime || !endTime || new Date(endTime) <= new Date(startTime)) return NextResponse.json({ success: false, message: "请完整填写标题、开始时间和截止时间" }, { status: 400 }); const data = await prisma.passageSession.create({ data: { title: title.trim(), startTime: new Date(startTime), endTime: new Date(endTime), departmentIds: JSON.stringify(Array.isArray(departmentIds) ? departmentIds : []) } }); return NextResponse.json({ success: true, data }); } catch { return NextResponse.json({ success: false, message: "创建过堂场次失败" }, { status: 500 }); } }
