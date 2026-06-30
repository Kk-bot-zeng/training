import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import dayjs from "dayjs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trainingId = searchParams.get("trainingId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: Record<string, unknown> = {};
    if (trainingId) {
      where.trainingId = parseInt(trainingId);
    }
    if (startDate || endDate) {
      where.training = {};
      if (startDate) (where.training as Record<string, unknown>).date = { gte: new Date(startDate) };
      if (endDate) {
        (where.training as Record<string, unknown>).date = {
          ...((where.training as Record<string, unknown>).date as object || {}),
          lte: new Date(endDate),
        };
      }
    }

    const records = await prisma.attendance.findMany({
      where,
      include: {
        employee: { include: { department: true } },
        training: true,
      },
      orderBy: [{ training: { date: "desc" } }, { employee: { name: "asc" } }],
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("考勤记录");

    sheet.columns = [
      { header: "培训名称", key: "trainingTitle", width: 30 },
      { header: "培训日期", key: "trainingDate", width: 15 },
      { header: "培训类型", key: "trainingType", width: 10 },
      { header: "员工姓名", key: "employeeName", width: 12 },
      { header: "工号", key: "employeeNo", width: 12 },
      { header: "部门", key: "department", width: 12 },
      { header: "考勤状态", key: "status", width: 10 },
      { header: "签到时间", key: "checkInTime", width: 20 },
      { header: "备注", key: "remark", width: 20 },
    ];

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1890FF" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    const statusMap: Record<string, string> = {
      present: "出席",
      late: "迟到",
      leave: "请假",
      absent: "缺席",
    };
    const typeMap: Record<string, string> = {
      training: "培训",
      exam: "考试",
    };

    for (const r of records) {
      sheet.addRow({
        trainingTitle: r.training.title,
        trainingDate: dayjs(r.training.date).format("YYYY-MM-DD"),
        trainingType: typeMap[r.training.type] || r.training.type,
        employeeName: r.employee.name,
        employeeNo: r.employee.employeeNo,
        department: r.employee.department.name,
        status: statusMap[r.status] || r.status,
        checkInTime: r.checkInTime
          ? dayjs(r.checkInTime).format("YYYY-MM-DD HH:mm:ss")
          : "-",
        remark: r.remark || "",
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="attendance_${dayjs().format("YYYYMMDD")}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Export attendance error:", error);
    return NextResponse.json(
      { success: false, message: "导出失败" },
      { status: 500 }
    );
  }
}
