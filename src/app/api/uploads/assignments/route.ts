import { issueSignedToken } from "@vercel/blob";
import { getVercelOidcToken } from "@vercel/oidc";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

const MAX_SIZE = 200 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = [
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv", "application/zip", "application/vnd.rar", "application/x-rar-compressed", "application/octet-stream",
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm", "video/x-matroska",
];

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
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
        return {
          token: await issueSignedToken({
            storeId: process.env.BLOB_STORE_ID!, oidcToken, pathname,
            operations: ["put"], allowedContentTypes: ALLOWED_CONTENT_TYPES,
            maximumSizeInBytes: MAX_SIZE,
          }),
          urlOptions: { access: "public", allowedContentTypes: ALLOWED_CONTENT_TYPES, maximumSizeInBytes: MAX_SIZE },
        };
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error("Assignment upload error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "作业文件上传失败" }, { status: 400 });
  }
}
