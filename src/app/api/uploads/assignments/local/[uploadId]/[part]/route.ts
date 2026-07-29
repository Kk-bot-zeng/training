import { readFile, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

export async function PUT(request: Request, { params }: { params: Promise<{ uploadId: string; part: string }> }) {
  try {
    const user = await getAuthUser();
    const root = process.env.UPLOAD_ROOT;
    if (!root) throw new Error("本地文件存储未配置");
    const { uploadId, part } = await params;
    if (!/^[0-9a-f-]{36}$/.test(uploadId) || !/^\d+$/.test(part)) throw new Error("上传参数无效");
    const uploadDir = path.join(root, ".tmp", String(user.id), request.headers.get("x-assignment-id") || "", uploadId);
    const meta = JSON.parse(await readFile(path.join(uploadDir, "meta.json"), "utf8")) as { employeeId: number; partCount: number };
    const partNumber = Number(part);
    if (meta.employeeId !== user.id || partNumber < 0 || partNumber >= meta.partCount) throw new Error("无权上传该文件分片");
    const data = Buffer.from(await request.arrayBuffer());
    if (!data.length || data.length > 10 * 1024 * 1024) throw new Error("文件分片大小无效");
    await writeFile(path.join(uploadDir, `part-${partNumber}`), data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "分片上传失败" }, { status: 400 });
  }
}
