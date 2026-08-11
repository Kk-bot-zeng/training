import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getAuthAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await getAuthAdmin();
    const uploadRoot = process.env.UPLOAD_ROOT;
    const root = process.env.MATERIAL_ROOT || (uploadRoot ? path.join(path.dirname(uploadRoot), "protected-uploads") : undefined);
    if (!root) throw new Error("本地文件存储未配置");
    const { uploadId } = await request.json();
    const dir = path.join(root, ".tmp", "materials", uploadId);
    const meta = JSON.parse(await readFile(path.join(dir, "meta.json"), "utf8")) as { name: string; size: number; type: string; partCount: number };
    const finalDir = path.join(root, "training-materials");
    await mkdir(finalDir, { recursive: true });
    const temp = path.join(finalDir, `${uploadId}.uploading`);
    await writeFile(temp, Buffer.alloc(0));
    for (let index = 0; index < meta.partCount; index++) await appendFile(temp, await readFile(path.join(dir, `part-${index}`)));
    if ((await stat(temp)).size !== meta.size) throw new Error("文件合并校验失败");
    const finalName = `${uploadId}-${path.basename(meta.name).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await rename(temp, path.join(finalDir, finalName));
    await rm(dir, { recursive: true, force: true });
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
    return NextResponse.json({ success: true, data: { url: `${baseUrl}/assignment-files/training-materials/${finalName}` } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "完成上传失败" }, { status: 400 });
  }
}
