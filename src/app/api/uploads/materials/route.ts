import { issueSignedToken } from "@vercel/blob";
import { getVercelOidcToken } from "@vercel/oidc";
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getAuthAdmin } from "@/lib/auth";

const ALLOWED_CONTENT_TYPES = [
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/pdf",
];

export async function GET() {
  try {
    await getAuthAdmin();
    const storeId = process.env.BLOB_STORE_ID;
    if (!storeId) {
      return NextResponse.json({
        success: false,
        configured: false,
        message: "Vercel Blob Store 尚未连接到当前生产环境",
      });
    }

    const oidcToken = await getVercelOidcToken();
    await issueSignedToken({
      storeId,
      oidcToken,
      pathname: "training-materials/connection-check",
      operations: ["put"],
      maximumSizeInBytes: 1,
    });
    return NextResponse.json({
      success: true,
      configured: true,
    });
  } catch (error) {
    console.error("Blob connection check error:", error);
    return NextResponse.json(
      {
        success: false,
        configured: false,
        message: error instanceof Error ? error.message : "Blob 连接检查失败",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await getAuthAdmin();
    if (!process.env.BLOB_STORE_ID) {
      return NextResponse.json(
        { error: "Vercel Blob Store 尚未连接到当前生产环境" },
        { status: 503 },
      );
    }

    const body = (await request.json()) as HandleUploadPresignedBody;
    const oidcToken = await getVercelOidcToken();
    const response = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => ({
        token: await issueSignedToken({
          storeId: process.env.BLOB_STORE_ID,
          oidcToken,
          pathname,
          operations: ["put"],
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: 50 * 1024 * 1024,
        }),
        urlOptions: {
          access: "public",
          addRandomSuffix: true,
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: 50 * 1024 * 1024,
        },
      }),
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
