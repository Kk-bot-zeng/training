import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { assertAssignmentUploadAccess } from "@/lib/assignment-access";

const MAX_SIZE = 2 * 1024 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (user.role !== "employee") throw new Error("仅学员可以上传作业");
    const root = process.env.UPLOAD_ROOT;
    if (!root) return NextResponse.json({ success: false, message: "本地文件存储未配置" }, { status: 503 });
    const { assignmentId, name, size, type, partCount, resumeUploadId } = await request.json();
    if (!Number.isInteger(assignmentId) || !name || size <= 0 || size > MAX_SIZE || partCount <= 0) {
      return NextResponse.json({ success: false, message: "文件参数无效或超过 2GB" }, { status: 400 });
    }
    await assertAssignmentUploadAccess(assignmentId, user.id);
    if (typeof resumeUploadId === "string" && /^[0-9a-f-]{36}$/.test(resumeUploadId)) {
      const resumeDir = path.join(root, ".tmp", String(user.id), String(assignmentId), resumeUploadId);
      try {
        const meta = JSON.parse(await readFile(path.join(resumeDir, "meta.json"), "utf8")) as {
          employeeId: number; assignmentId: number; name: string; size: number; partCount: number;
        };
        if (meta.employeeId === user.id && meta.assignmentId === assignmentId
          && meta.name === name && meta.size === size && meta.partCount === partCount) {
          return NextResponse.json({ success: true, data: { uploadId: resumeUploadId, resumed: true } });
        }
      } catch {}
    }
    const uploadId = randomUUID();
    const uploadDir = path.join(root, ".tmp", String(user.id), String(assignmentId), uploadId);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, "meta.json"), JSON.stringify({ employeeId: user.id, assignmentId, name, size, type, partCount }));
    return NextResponse.json({ success: true, data: { uploadId } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "初始化上传失败" }, { status: 400 });
  }
}
