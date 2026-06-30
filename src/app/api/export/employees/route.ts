import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import dayjs from "dayjs";

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      where: { status: "active" },
      include: { department: true },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("员工花名册");

    sheet.columns = [
      { header: "姓名", key: "name", width: 12 },
      { header: "工号", key: "employeeNo", width: 15 },
      { header: "部门", key: "department", width: 15 },
      { header: "手机号", key: "phone", width: 15 },
      { header: "状态", key: "status", width: 10 },
      { header: "创建时间", key: "createdAt", width: 20 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1890FF" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    for (const emp of employees) {
      sheet.addRow({
        name: emp.name,
        employeeNo: emp.employeeNo,
        department: emp.department.name,
        phone: emp.phone || "",
        status: emp.status === "active" ? "在职" : "离职",
        createdAt: dayjs(emp.createdAt).format("YYYY-MM-DD HH:mm:ss"),
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="employees_${dayjs().format("YYYYMMDD")}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Export employees error:", error);
    return NextResponse.json(
      { success: false, message: "导出失败" },
      { status: 500 }
    );
  }
}
