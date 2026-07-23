import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

type DepartmentStat = { id: number; name: string; total: number; attended: number };

export async function GET(request: NextRequest) {
  try {
    await getAuthAdmin();
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const dateFilters: Prisma.Sql[] = [];
    if (startDate) dateFilters.push(Prisma.sql`t."date" >= ${new Date(startDate)}`);
    if (endDate) dateFilters.push(Prisma.sql`t."date" <= ${new Date(endDate)}`);
    const dateClause = dateFilters.length
      ? Prisma.sql`AND ${Prisma.join(dateFilters, " AND ")}`
      : Prisma.empty;

    const deptStats = await prisma.$queryRaw<DepartmentStat[]>(Prisma.sql`
      SELECT d."id", d."name",
        COUNT(a."id")::int AS "total",
        COUNT(a."id") FILTER (WHERE a."status" IN ('present', 'late'))::int AS "attended"
      FROM "Attendance" a
      INNER JOIN "Employee" e ON e."id" = a."employeeId"
      INNER JOIN "Department" d ON d."id" = e."departmentId"
      INNER JOIN "Training" t ON t."id" = a."trainingId"
      WHERE 1 = 1 ${dateClause}
      GROUP BY d."id", d."name"
    `);

    const result = deptStats
      .map((d) => ({ ...d, rate: ((d.attended / d.total) * 100).toFixed(1) + "%" }))
      .sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate));

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Department stats error:", error);
    return NextResponse.json(
      { success: false, message: "获取部门统计失败" },
      { status: 500 }
    );
  }
}
