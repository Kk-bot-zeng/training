import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseEmployeeExcel } from "@/lib/excel";
import { getAuthAdmin } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    await getAuthAdmin();
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "请选择文件" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const rows = parseEmployeeExcel(buffer);

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2; // Excel row (1-indexed + header)

      if (!row.name || !row.departmentName || !row.password) {
        errors.push(`第${lineNum}行: 姓名、部门和密码不能为空`);
        skipped++;
        continue;
      }
      if (row.password.length < 4) {
        errors.push(`第${lineNum}行: 密码至少4位`);
        skipped++;
        continue;
      }

      // Find department by name
      const department = await prisma.department.findFirst({
        where: { name: row.departmentName },
      });
      if (!department) {
        errors.push(
          `第${lineNum}行: 部门"${row.departmentName}"不存在，请先在系统中创建该部门`
        );
        skipped++;
        continue;
      }

      try {
        const passwordHash = await bcrypt.hash(row.password, 10);
        await prisma.employee.create({
          data: {
            name: row.name,
            employeeNo: null,
            departmentId: department.id,
            phone: null,
            passwordHash,
            status: "active",
          },
        });
        created++;
      } catch {
        errors.push(`第${lineNum}行: 创建失败`);
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        total: rows.length,
        created,
        skipped,
        errors: errors.slice(0, 20), // Max 20 error messages
      },
    });
  } catch (error) {
    console.error("Import employees error:", error);
    return NextResponse.json(
      { success: false, message: "导入失败，请检查文件格式" },
      { status: 500 }
    );
  }
}
