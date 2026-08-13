import * as XLSX from "xlsx";

export type CatcherImportRow = {
  question: string;
  answer?: string;
  productModel?: string;
  category?: string;
  source?: string;
};

const text = (value: unknown) => String(value ?? "").trim();

export function downloadCatcherTemplate(admin: boolean) {
  const headers = admin
    ? [
        "问题（必填）",
        "答案（选填）",
        "产品型号（选填）",
        "问题分类（选填）",
        "内容类型（选填）",
      ]
    : ["问题（必填）", "产品型号（选填）", "问题分类（选填）"];
  const example = admin
    ? [
        "如何开启投屏？",
        "进入设置后选择无线投屏",
        "鹤7 Pro 26款",
        "功能使用",
        "管理员问答",
      ]
    : ["如何开启投屏？", "鹤7 Pro 26款", "功能使用"];
  const sheet = XLSX.utils.aoa_to_sheet([headers, example]);
  sheet["!cols"] = headers.map((_, index) => ({ wch: index < 2 ? 38 : 20 }));
  sheet["!autofilter"] = {
    ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}1`,
  };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "问题导入");
  XLSX.writeFile(
    book,
    admin
      ? "捕手计划-管理员问答导入模板.xlsx"
      : "捕手计划-学员问题导入模板.xlsx",
  );
}

export async function parseCatcherWorkbook(file: File, admin: boolean) {
  const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) throw new Error("表格中没有可读取的工作表");
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  const rows: CatcherImportRow[] = records.map((record) => ({
    question: text(
      record["问题（必填）"] ?? record["问题"] ?? record["问题内容"],
    ),
    answer: admin
      ? text(record["答案（选填）"] ?? record["答案"] ?? record["标准答案"])
      : undefined,
    productModel: text(
      record["产品型号（选填）"] ?? record["产品型号"] ?? record["型号"],
    ),
    category: text(
      record["问题分类（选填）"] ?? record["问题分类"] ?? record["分类"],
    ),
    source: admin
      ? text(record["内容类型（选填）"] ?? record["内容类型"])
      : undefined,
  }));
  if (!rows.length) throw new Error("表格中没有数据");
  if (rows.length > 1000) throw new Error("单次最多导入1000条，请拆分后重试");
  return rows;
}
