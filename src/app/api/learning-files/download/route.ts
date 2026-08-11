import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(); const url = request.nextUrl.searchParams.get("url");
    if (user.role === "employee") return NextResponse.json({ success: false, message: "学员端不允许下载学习资料" }, { status: 403 });
    if (!url) return NextResponse.json({ success: false, message: "资料地址无效" }, { status: 400 });
    const externalUrl = url.match(/https:\/\/[^\s]+/i)?.[0];
    if (!url.includes("/assignment-files/training-materials/")) {
      if (!externalUrl) return NextResponse.json({ success: false, message: "外部资料地址无效" }, { status: 400 });
      return NextResponse.redirect(externalUrl, 302);
    }
    const uploadRoot = process.env.UPLOAD_ROOT || ""; const root = process.env.MATERIAL_ROOT || path.join(path.dirname(uploadRoot), "protected-uploads");
    const name = path.basename(new URL(url).pathname); const filePath = path.join(root, "training-materials", name); const info = await stat(filePath);
    return new NextResponse(Readable.toWeb(createReadStream(filePath)) as ReadableStream, { headers: { "Content-Type": "application/octet-stream", "Content-Length": String(info.size), "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`, "Cache-Control": "private, max-age=3600" } });
  } catch { return NextResponse.json({ success: false, message: "资料不存在或无权访问" }, { status: 404 }); }
}
