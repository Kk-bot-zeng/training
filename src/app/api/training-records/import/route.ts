import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { getAuthAdmin } from "@/lib/auth";

const REQUIRED_HEADERS = ["培训主题", "培训对象", "培训时间", "需求发起人"];
const ALL_HEADERS = ["培训主题", "培训对象", "培训时间", "需求发起人", "培训形式", "参训人数", "讲师", "需求描述", "需求状态", "课件", "培训录屏"];
const formatMap: Record<string, string> = { 线上: "online", 线下: "offline", 混合: "hybrid" };
const statusMap: Record<string, string> = { 待开始: "pending", 进行中: "ongoing", 已完成: "completed", 已结束: "completed" };

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function parseExcelDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
  }
  const raw = text(value);
  if (!raw) return null;
  const normalized = raw.replace(/[年/.]/g, "-").replace(/月/g, "-").replace(/日/g, "");
  const date = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: NextRequest) {
  try {
    await getAuthAdmin();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ success: false, message: "请选择 Excel 文件" }, { status: 400 });
    if (!/\.xlsx?$/i.test(file.name)) return NextResponse.json({ success: false, message: "仅支持 .xlsx 或 .xls 文件" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ success: false, message: "导入文件不能超过 10MB" }, { status: 400 });

    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return NextResponse.json({ success: false, message: "Excel 中没有可读取的工作表" }, { status: 400 });
    const headerRow = (XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, range: 0 })[0] || []).map(text);
    const missingHeaders = REQUIRED_HEADERS.filter((header) => !headerRow.includes(header));
    if (missingHeaders.length) return NextResponse.json({ success: false, message: `模板格式不正确，缺少列：${missingHeaders.join("、")}。请下载最新版模板。` }, { status: 400 });
    const unknownHeaders = headerRow.filter((header) => header && !ALL_HEADERS.includes(header));
    if (unknownHeaders.length) return NextResponse.json({ success: false, message: `模板中存在无法识别的列：${unknownHeaders.join("、")}` }, { status: 400 });

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
    if (!rows.length) return NextResponse.json({ success: false, message: "模板中没有可导入的数据" }, { status: 400 });
    if (rows.length > 2000) return NextResponse.json({ success: false, message: "单次最多导入 2000 条培训档案" }, { status: 400 });

    let created = 0;
    const errors: string[] = [];
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNo = index + 2;
      const topic = text(row["培训主题"]);
      const target = text(row["培训对象"]);
      const trainingDate = parseExcelDate(row["培训时间"]);
      const initiator = text(row["需求发起人"]);
      const format = text(row["培训形式"]);
      const rawCount = Number(row["参训人数"] ?? 0);
      const count = Number.isInteger(rawCount) && rawCount >= 0 ? rawCount : -1;
      const instructor = text(row["讲师"]);
      const description = text(row["需求描述"]);
      const status = text(row["需求状态"]);
      const materialsText = text(row["课件"]);
      const recording = text(row["培训录屏"]);

      if (!topic || !target || !trainingDate || !initiator) { errors.push(`第${rowNo}行：培训主题、培训对象、有效培训时间、需求发起人均为必填项`); continue; }
      if (format && !formatMap[format]) { errors.push(`第${rowNo}行：培训形式只能填写“线上、线下、混合”`); continue; }
      if (status && !statusMap[status]) { errors.push(`第${rowNo}行：需求状态只能填写“待开始、进行中、已完成”`); continue; }
      if (count < 0) { errors.push(`第${rowNo}行：参训人数必须是大于或等于 0 的整数`); continue; }

      const links = materialsText.split("|").map((item) => item.trim()).filter(Boolean);
      const materials = links.length ? JSON.stringify(links.map((url, linkIndex) => ({ name: `课件${linkIndex + 1}`, url, type: "link" }))) : null;
      try {
        await prisma.trainingRecord.create({ data: {
          topic, target, date: trainingDate, initiator, format: formatMap[format] || "offline",
          participantCount: count, instructor: instructor || null, description: description || null,
          status: statusMap[status] || "completed", materials, recording: recording || null,
        } });
        created++;
      } catch { errors.push(`第${rowNo}行：创建失败`); }
    }

    return NextResponse.json({ success: true, data: { total: rows.length, created, errors: errors.slice(0, 50) } });
  } catch (error) {
    console.error("Import training records error:", error);
    return NextResponse.json({ success: false, message: "导入失败，请确认文件未损坏并使用最新版模板" }, { status: 500 });
  }
}
