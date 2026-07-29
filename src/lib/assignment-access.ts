import { prisma } from "@/lib/prisma";

export async function assertAssignmentUploadAccess(assignmentId: number, employeeId: number) {
  const [assignment, employee] = await Promise.all([
    prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { departmentIds: true, status: true, dueDate: true },
    }),
    prisma.employee.findUnique({ where: { id: employeeId }, select: { departmentId: true } }),
  ]);
  if (!assignment || assignment.status !== "published" || assignment.dueDate.getTime() < Date.now()) {
    throw new Error("该作业当前不可提交");
  }
  const departmentIds = JSON.parse(assignment.departmentIds || "[]") as number[];
  if (!employee || (departmentIds.length > 0 && !departmentIds.includes(employee.departmentId))) {
    throw new Error("您不在该作业的提交范围内");
  }
}
