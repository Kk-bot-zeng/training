import * as XLSX from "xlsx";

export interface EmployeeImportRow {
  name: string;
  employeeNo: string;
  departmentName: string;
  phone?: string;
}

export function parseEmployeeExcel(buffer: ArrayBuffer): EmployeeImportRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  return rows.map((row) => ({
    name: (row["姓名"] || row["name"] || "").toString().trim(),
    employeeNo: (row["工号"] || row["employeeNo"] || row["工號"] || "")
      .toString()
      .trim(),
    departmentName: (row["部门"] || row["department"] || row["部門"] || "")
      .toString()
      .trim(),
    phone: (row["手机号"] || row["phone"] || row["手機號"] || "")
      .toString()
      .trim(),
  }));
}

export const ATTENDANCE_STATUS_MAP: Record<string, string> = {
  present: "出席",
  late: "迟到",
  leave: "请假",
  absent: "缺席",
};

export const TRAINING_TYPE_MAP: Record<string, string> = {
  training: "培训",
  exam: "考试",
};
