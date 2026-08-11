import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getAuthAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await getAuthAdmin();
    const uploadRoot = process.env.UPLOAD_ROOT;
    const root = process.env.MATERIAL_ROOT || (uploadRoot ? path.join(path.dirname(uploadRoot), "protected-uploads") : undefined);
    if (!root) throw new Error("本地文件存储未配置");
    const { name, size, type, partCount } = await request.json();
    if (!name || size <= 0 || size > 2 * 1024 * 1024 * 1024 || partCount <= 0) throw new Error("文件参数无效或超过 2GB");
    const uploadId = randomUUID();
    const dir = path.join(root, ".tmp", "materials", uploadId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "meta.json"), JSON.stringify({ name, size, type, partCount }));
    return NextResponse.json({ success: true, data: { uploadId } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "初始化上传失败" }, { status: 400 });
  }
}
