import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getAuthAdmin } from "@/lib/auth";

const ALLOWED_CONTENT_TYPES = [
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/pdf",
];

function getBlobToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;

  const prefixedToken = Object.entries(process.env).find(
    ([key, value]) => key.endsWith("BLOB_READ_WRITE_TOKEN") && Boolean(value),
  );
  return prefixedToken?.[1];
}

export async function GET() {
  try {
    await getAuthAdmin();
    return NextResponse.json({ success: true, configured: Boolean(getBlobToken()) });
  } catch {
    return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const token = getBlobToken();
    if (!token) {
      return NextResponse.json(
        { error: "Vercel Blob 读写令牌尚未配置到当前生产环境" },
        { status: 503 },
      );
    }
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      token,
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        await getAuthAdmin();
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: 50 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error("Material upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "课件上传失败" },
      { status: 400 },
    );
  }
}
