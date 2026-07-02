import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import dayjs from "dayjs";

const statusMap: Record<string, string> = {
  present: "出席", late: "迟到", leave: "请假", absent: "缺席",
};
const typeMap: Record<string, string> = {
  training: "培训", exam: "考试",
};

function styleHeader(sheet: ExcelJS.Worksheet, columns: Partial<ExcelJS.Column>[]) {
  sheet.columns = columns;
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  row.alignment = { horizontal: "center", vertical: "middle" };
  row.height = 28;
}

function styleRow(row: ExcelJS.Row, isEven: boolean) {
  if (isEven) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
  row.alignment = { vertical: "middle" };
  row.height = 24;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trainingId = searchParams.get("trainingId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const exportType = searchParams.get("type"); // "comprehensive" for multi-sheet

    const trainingWhere: Record<string, unknown> = {};
    if (startDate) trainingWhere.date = { gte: new Date(startDate) };
    if (endDate) trainingWhere.date = { ...(trainingWhere.date as object || {}), lte: new Date(endDate) };

    // Fetch all needed data
    const [records, trainings, employees, departments] = await Promise.all([
      prisma.attendance.findMany({
        where: trainingId ? { trainingId: parseInt(trainingId) } : (startDate || endDate ? { training: trainingWhere } : {}),
        include: { employee: { include: { department: true } }, training: true },
        orderBy: [{ training: { date: "desc" } }, { employee: { name: "asc" } }],
      }),
      prisma.training.findMany({ where: trainingWhere, orderBy: { date: "desc" }, include: { attendance: true } }),
      prisma.employee.findMany({ where: { status: "active" }, include: { department: true, attendance: { include: { training: true } } }, orderBy: { name: "asc" } }),
      prisma.department.findMany(),
    ]);

    const workbook = new ExcelJS.Workbook();

    if (exportType === "comprehensive") {
      // ===== Sheet 1: 综合概览 =====
      const s1 = workbook.addWorksheet("综合概览");
      const totalTrainings = trainings.length;
      const totalAttendance = records.length;
      const attended = records.filter(r => ["present", "late"].includes(r.status)).length;
      const overallRate = totalAttendance > 0 ? ((attended / totalAttendance) * 100).toFixed(1) : "0.0";

      s1.mergeCells("A1:D1");
      const titleCell = s1.getCell("A1");
      titleCell.value = "培训考勤综合报表";
      titleCell.font = { bold: true, size: 18, color: { argb: "FF1E293B" } };
      titleCell.alignment = { horizontal: "center" };
      s1.getRow(1).height = 40;

      s1.mergeCells("A2:D2");
      const dateCell = s1.getCell("A2");
      dateCell.value = `统计周期：${startDate ? dayjs(startDate).format("YYYY年MM月DD日") : "全部"} ~ ${endDate ? dayjs(endDate).format("YYYY年MM月DD日") : dayjs().format("YYYY年MM月DD日")}`;
      dateCell.font = { size: 12, color: { argb: "FF64748B" } };
      dateCell.alignment = { horizontal: "center" };

      s1.addRow([]);
      const summaryData = [
        ["总培训场次", `${totalTrainings} 场`, "总考勤记录", `${totalAttendance} 条`],
        ["总出勤率", `${overallRate}%`, "在职员工", `${employees.length} 人`],
      ];
      for (const row of summaryData) s1.addRow(row);
      styleHeader(s1, [{ key: "a", width: 18 }, { key: "b", width: 18 }, { key: "c", width: 18 }, { key: "d", width: 18 }]);

      s1.addRow([]);
      s1.addRow(["部门出勤率对比"]);
      s1.getRow(s1.rowCount).font = { bold: true, size: 14 };

      const deptHeaderRow = s1.addRow(["部门", "总人次", "出勤人次", "出勤率"]);
      deptHeaderRow.font = { bold: true };
      for (const d of departments) {
        const dRecords = records.filter(r => r.employee.departmentId === d.id);
        const dTotal = dRecords.length;
        const dAttended = dRecords.filter(r => ["present", "late"].includes(r.status)).length;
        const dRate = dTotal > 0 ? ((dAttended / dTotal) * 100).toFixed(1) + "%" : "0.0%";
        s1.addRow([d.name, dTotal, dAttended, dRate]);
      }

      // ===== Sheet 2: 培训明细 =====
      const s2 = workbook.addWorksheet("培训明细");
      styleHeader(s2, [
        { header: "培训名称", key: "title", width: 28 }, { header: "日期", key: "date", width: 14 },
        { header: "类型", key: "type", width: 10 }, { header: "应到人数", key: "total", width: 10 },
        { header: "出席", key: "present", width: 8 }, { header: "迟到", key: "late", width: 8 },
        { header: "请假", key: "leave", width: 8 }, { header: "缺勤", key: "absent", width: 8 },
        { header: "出勤率", key: "rate", width: 10 },
      ]);
      let rowIdx = 0;
      for (const t of trainings) {
        const a = t.attendance;
        const pres = a.filter(r => r.status === "present").length;
        const lat = a.filter(r => r.status === "late").length;
        const lea = a.filter(r => r.status === "leave").length;
        const abs = a.filter(r => r.status === "absent").length;
        const rate = a.length > 0 ? ((pres + lat) / a.length * 100).toFixed(1) + "%" : "0.0%";
        const row = s2.addRow([t.title, dayjs(t.date).format("YYYY-MM-DD"), typeMap[t.type], a.length, pres, lat, lea, abs, rate]);
        styleRow(row, rowIdx % 2 === 0);
        rowIdx++;
      }

      // ===== Sheet 3: 员工统计 =====
      const s3 = workbook.addWorksheet("员工统计");
      styleHeader(s3, [
        { header: "姓名", key: "name", width: 12 }, { header: "工号", key: "no", width: 14 },
        { header: "部门", key: "dept", width: 14 }, { header: "出勤次数", key: "attended", width: 10 },
        { header: "迟到次数", key: "late", width: 10 }, { header: "缺勤次数", key: "absent", width: 10 },
        { header: "总培训", key: "total", width: 10 }, { header: "出勤率", key: "rate", width: 10 },
      ]);
      rowIdx = 0;
      for (const emp of employees) {
        const empRecords = emp.attendance.filter(a => startDate && endDate
          ? a.training.date >= new Date(startDate) && a.training.date <= new Date(endDate)
          : true
        );
        const total = empRecords.length;
        const att = empRecords.filter(r => ["present", "late"].includes(r.status)).length;
        const lat = empRecords.filter(r => r.status === "late").length;
        const abs = empRecords.filter(r => r.status === "absent").length;
        const rate = total > 0 ? ((att / total) * 100).toFixed(1) + "%" : "N/A";
        const row = s3.addRow([emp.name, emp.employeeNo, emp.department.name, att, lat, abs, total, rate]);
        styleRow(row, rowIdx % 2 === 0);
        rowIdx++;
      }

      // ===== Sheet 4: 考勤明细 =====
      const s4 = workbook.addWorksheet("考勤明细");
      styleHeader(s4, [
        { header: "培训名称", key: "ttl", width: 28 }, { header: "培训日期", key: "dt", width: 14 },
        { header: "类型", key: "tp", width: 10 }, { header: "员工姓名", key: "nm", width: 12 },
        { header: "工号", key: "no", width: 12 }, { header: "部门", key: "dp", width: 14 },
        { header: "状态", key: "st", width: 10 }, { header: "签到时间", key: "ct", width: 20 },
        { header: "备注", key: "rm", width: 20 },
      ]);
      rowIdx = 0;
      for (const r of records) {
        const row = s4.addRow([
          r.training.title, dayjs(r.training.date).format("YYYY-MM-DD"), typeMap[r.training.type],
          r.employee.name, r.employee.employeeNo, r.employee.department.name,
          statusMap[r.status], r.checkInTime ? dayjs(r.checkInTime).format("YYYY-MM-DD HH:mm:ss") : "-", r.remark || "",
        ]);
        styleRow(row, rowIdx % 2 === 0);
        rowIdx++;
      }
    } else {
      // Simple single-sheet export (original behavior)
      const sheet = workbook.addWorksheet("考勤记录");
      styleHeader(sheet, [
        { header: "培训名称", key: "t", width: 28 }, { header: "培训日期", key: "d", width: 14 },
        { header: "培训类型", key: "tp", width: 10 }, { header: "员工姓名", key: "n", width: 12 },
        { header: "工号", key: "no", width: 12 }, { header: "部门", key: "dp", width: 14 },
        { header: "考勤状态", key: "s", width: 10 }, { header: "签到时间", key: "c", width: 20 },
        { header: "备注", key: "r", width: 20 },
      ]);
      let ri = 0;
      for (const r of records) {
        const row = sheet.addRow([
          r.training.title, dayjs(r.training.date).format("YYYY-MM-DD"), typeMap[r.training.type],
          r.employee.name, r.employee.employeeNo, r.employee.department.name,
          statusMap[r.status], r.checkInTime ? dayjs(r.checkInTime).format("YYYY-MM-DD HH:mm:ss") : "-", r.remark || "",
        ]);
        styleRow(row, ri % 2 === 0);
        ri++;
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="考勤报表_${dayjs().format("YYYYMMDD")}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ success: false, message: "导出失败" }, { status: 500 });
  }
}
