import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { getAuthAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    await getAuthAdmin();
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ success: false, message: "请选择文件" }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

    let created = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const topic = row["培训主题"]?.trim();
      const target = row["培训对象"]?.trim();
      const dateStr = row["培训时间"]?.trim();
      const initiator = row["需求发起人"]?.trim();
      const format = row["培训形式"]?.trim();
      const count = parseInt(row["参训人数"]) || 0;
      const instructor = row["讲师"]?.trim();
      const description = row["需求描述"]?.trim();
      const status = row["需求状态"]?.trim();
      const materialsStr = row["课件"]?.trim();
      const recording = row["培训录屏"]?.trim();

      if (!topic || !target || !dateStr || !initiator) {
        errors.push(`第${i + 2}行: 培训主题/对象/时间/发起人不能为空`);
        continue;
      }

      const formatMap: Record<string, string> = { "线上": "online", "线下": "offline", "混合": "hybrid" };
      const statusMap: Record<string, string> = { "待开始": "pending", "进行中": "ongoing", "已完成": "completed", "已结束": "completed" };

      let materials = null;
      if (materialsStr) {
        try { materials = JSON.stringify(JSON.parse(materialsStr)); } catch {
          materials = JSON.stringify([{ name: materialsStr, url: "", type: "link" }]);
        }
      }

      try {
        await prisma.trainingRecord.create({
          data: {
            topic, target, date: new Date(dateStr), initiator,
            format: formatMap[format] || "offline",
            participantCount: count,
            instructor: instructor || null,
            description: description || null,
            status: statusMap[status] || "completed",
            materials,
            recording: recording || null,
          },
        });
        created++;
      } catch { errors.push(`第${i + 2}行: 创建失败`); }
    }

    return NextResponse.json({ success: true, data: { total: rows.length, created, errors: errors.slice(0, 20) } });
  } catch (error) {
    console.error("Import training records error:", error);
    return NextResponse.json({ success: false, message: "导入失败" }, { status: 500 });
  }
}
