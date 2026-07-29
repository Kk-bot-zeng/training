import { issueSignedToken } from "@vercel/blob";
import { getVercelOidcToken } from "@vercel/oidc";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_SIZE = 700 * 1024 * 1024;
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (user.role !== "employee") throw new Error("仅学员可以提交作业文件");
    if (!process.env.BLOB_STORE_ID) {
      return NextResponse.json({ error: "Vercel Blob Store 尚未连接" }, { status: 503 });
    }
    const body = (await request.json()) as HandleUploadPresignedBody;
    const oidcToken = await getVercelOidcToken();
    const response = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        if (!pathname.startsWith(`assignment-files/${user.id}/`)) throw new Error("非法上传路径");
        const assignmentId = Number(pathname.split("/")[2]);
        const [assignment, employee] = await Promise.all([
          prisma.assignment.findUnique({ where: { id: assignmentId }, select: { departmentIds: true, status: true, dueDate: true } }),
          prisma.employee.findUnique({ where: { id: user.id }, select: { departmentId: true } }),
        ]);
        if (!assignment || assignment.status !== "published" || assignment.dueDate.getTime() < Date.now()) {
          throw new Error("该作业当前不可提交");
        }
        const departmentIds = JSON.parse(assignment.departmentIds || "[]") as number[];
        if (!employee || (departmentIds.length > 0 && !departmentIds.includes(employee.departmentId))) {
          throw new Error("您不在该作业的提交范围内");
        }
        return {
          token: await issueSignedToken({
            storeId: process.env.BLOB_STORE_ID!, oidcToken, pathname,
            operations: ["put"],
            maximumSizeInBytes: MAX_SIZE,
          }),
          urlOptions: { access: "public", maximumSizeInBytes: MAX_SIZE },
        };
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error("Assignment upload error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "作业文件上传失败" }, { status: 400 });
  }
}
