import * as XLSX from "xlsx";

export interface EmployeeImportRow {
  name: string;
  departmentName: string;
  password: string;
}

export function parseEmployeeExcel(buffer: ArrayBuffer): EmployeeImportRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  return rows.map((row) => ({
    name: (row["姓名"] || row["name"] || "").toString().trim(),
    departmentName: (row["部门"] || row["department"] || row["部門"] || "")
      .toString()
      .trim(),
    password: (row["密码"] || row["password"] || row["密碼"] || "")
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
