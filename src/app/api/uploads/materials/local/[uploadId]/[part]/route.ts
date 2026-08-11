import { readFile, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getAuthAdmin } from "@/lib/auth";

export async function PUT(request: Request, { params }: { params: Promise<{ uploadId: string; part: string }> }) {
  try {
    await getAuthAdmin();
    const uploadRoot = process.env.UPLOAD_ROOT;
    const root = process.env.MATERIAL_ROOT || (uploadRoot ? path.join(path.dirname(uploadRoot), "protected-uploads") : undefined);
    if (!root) throw new Error("本地文件存储未配置");
    const { uploadId, part } = await params;
    if (!/^[0-9a-f-]{36}$/.test(uploadId) || !/^\d+$/.test(part)) throw new Error("上传参数无效");
    const dir = path.join(root, ".tmp", "materials", uploadId);
    const meta = JSON.parse(await readFile(path.join(dir, "meta.json"), "utf8")) as { partCount: number };
    const index = Number(part);
    if (index < 0 || index >= meta.partCount) throw new Error("分片编号无效");
    const data = Buffer.from(await request.arrayBuffer());
    if (!data.length || data.length > 10 * 1024 * 1024) throw new Error("分片大小无效");
    await writeFile(path.join(dir, `part-${index}`), data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "分片上传失败" }, { status: 400 });
  }
}
