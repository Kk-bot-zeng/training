import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create admin
  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.admin.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash,
    },
  });

  // Create departments
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { name: "技术部" },
      update: {},
      create: { name: "技术部" },
    }),
    prisma.department.upsert({
      where: { name: "销售部" },
      update: {},
      create: { name: "销售部" },
    }),
    prisma.department.upsert({
      where: { name: "产品部" },
      update: {},
      create: { name: "产品部" },
    }),
    prisma.department.upsert({
      where: { name: "运营部" },
      update: {},
      create: { name: "运营部" },
    }),
    prisma.department.upsert({
      where: { name: "人力资源部" },
      update: {},
      create: { name: "人力资源部" },
    }),
  ]);

  console.log("Departments created:", departments.length);

  // Create sample employees
  const sampleEmployees = [
    { name: "张三", employeeNo: "EMP001", dept: "技术部" },
    { name: "李四", employeeNo: "EMP002", dept: "技术部" },
    { name: "王五", employeeNo: "EMP003", dept: "销售部" },
    { name: "赵六", employeeNo: "EMP004", dept: "销售部" },
    { name: "钱七", employeeNo: "EMP005", dept: "产品部" },
    { name: "孙八", employeeNo: "EMP006", dept: "产品部" },
    { name: "周九", employeeNo: "EMP007", dept: "运营部" },
    { name: "吴十", employeeNo: "EMP008", dept: "人力资源部" },
  ];

  const deptMap: Record<string, number> = {};
  for (const d of departments) {
    deptMap[d.name] = d.id;
  }

  let created = 0;
  for (const emp of sampleEmployees) {
    const deptId = deptMap[emp.dept];
    if (!deptId) continue;
    await prisma.employee.upsert({
      where: { employeeNo: emp.employeeNo },
      update: {},
      create: {
        name: emp.name,
        employeeNo: emp.employeeNo,
        departmentId: deptId,
        status: "active",
      },
    });
    created++;
  }

  console.log("Employees created:", created);
  console.log("Seed completed! Admin: admin / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
