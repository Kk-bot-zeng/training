import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    const root = process.env.UPLOAD_ROOT;
    if (!root) throw new Error("本地文件存储未配置");
    const { assignmentId, uploadId } = await request.json();
    const uploadDir = path.join(root, ".tmp", String(user.id), String(assignmentId), uploadId);
    const meta = JSON.parse(await readFile(path.join(uploadDir, "meta.json"), "utf8")) as { employeeId: number; name: string; size: number; type: string; partCount: number };
    if (meta.employeeId !== user.id) throw new Error("无权完成该文件上传");
    const safeName = path.basename(meta.name).replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
    const relativeDir = path.join(String(user.id), String(assignmentId));
    const finalDir = path.join(root, relativeDir);
    await mkdir(finalDir, { recursive: true });
    const tempFile = path.join(finalDir, `${uploadId}.uploading`);
    await writeFile(tempFile, Buffer.alloc(0));
    for (let index = 0; index < meta.partCount; index++) {
      await appendFile(tempFile, await readFile(path.join(uploadDir, `part-${index}`)));
    }
    if ((await stat(tempFile)).size !== meta.size) throw new Error("文件合并校验失败，请重新上传");
    const finalName = `${uploadId}-${safeName}`;
    await rename(tempFile, path.join(finalDir, finalName));
    await rm(uploadDir, { recursive: true, force: true });
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
    return NextResponse.json({ success: true, data: { name: meta.name, url: `${baseUrl}/assignment-files/${user.id}/${assignmentId}/${finalName}`, type: meta.type, size: meta.size } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "完成上传失败" }, { status: 400 });
  }
}
