import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Material = { name?: string; url?: string; type?: string };

function materials(value: string | null | undefined): Material[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function contentType(url: string) {
  const extension = path.extname(new URL(url).pathname).toLowerCase();
  const types: Record<string, string> = {
    ".pdf": "application/pdf", ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".m4v": "video/x-m4v",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  };
  return types[extension] || "application/octet-stream";
}

function responseHeaders(url: string, size?: number) {
  const name = path.basename(new URL(url).pathname) || "learning-material";
  const headers: Record<string, string> = {
    "Content-Type": contentType(url),
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Accept-Ranges": "bytes",
  };
  if (size !== undefined) headers["Content-Length"] = String(size);
  return headers;
}

async function resolveAuthorizedUrl(request: NextRequest) {
  const user = await getAuthUser();
  const scope = request.nextUrl.searchParams.get("scope");
  const id = Number(request.nextUrl.searchParams.get("id"));
  const kind = request.nextUrl.searchParams.get("kind");
  const index = Number(request.nextUrl.searchParams.get("index"));
  if (!id || !["training", "task"].includes(scope || "")) return null;

  if (scope === "training") {
    const record = await prisma.trainingRecord.findUnique({ where: { id }, select: { recording: true, materials: true } });
    if (!record) return null;
    return kind === "recording" ? record.recording : materials(record.materials)[index]?.url;
  }

  const assignment = await prisma.learningAssignment.findFirst({
    where: user.role === "admin" ? { id } : { id, employeeId: user.id },
    include: { task: { select: { recording: true, materials: true } } },
  });
  if (!assignment) return null;
  return kind === "recording" ? assignment.task.recording : materials(assignment.task.materials)[index]?.url;
}

export async function GET(request: NextRequest) {
  try {
    const url = await resolveAuthorizedUrl(request);
    if (!url) return NextResponse.json({ success: false, message: "资料不存在或无权查看" }, { status: 404 });

    const parsed = new URL(url);
    if (parsed.pathname.includes("/assignment-files/training-materials/")) {
      const name = path.basename(parsed.pathname);
      const uploadRoot = process.env.UPLOAD_ROOT || "";
      const root = process.env.MATERIAL_ROOT || path.join(path.dirname(uploadRoot), "protected-uploads");
      const filePath = path.join(root, "training-materials", name);
      const info = await stat(filePath);
      const range = request.headers.get("range");
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
        if (start > end || start >= info.size) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
        return new NextResponse(Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream, {
          status: 206,
          headers: { ...responseHeaders(url, end - start + 1), "Content-Range": `bytes ${start}-${end}/${info.size}` },
        });
      }
      return new NextResponse(Readable.toWeb(createReadStream(filePath)) as ReadableStream, { headers: responseHeaders(url, info.size) });
    }

    if (!/^https?:$/.test(parsed.protocol)) return NextResponse.json({ success: false, message: "资料地址无效" }, { status: 400 });
    const upstream = await fetch(url, { headers: request.headers.get("range") ? { Range: request.headers.get("range")! } : {}, redirect: "follow" });
    if (!upstream.ok && upstream.status !== 206) return NextResponse.json({ success: false, message: "资料暂时无法查看" }, { status: 502 });
    const headers = responseHeaders(url);
    for (const key of ["content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(key); if (value) headers[key] = value;
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch {
    return NextResponse.json({ success: false, message: "资料不存在或无权查看" }, { status: 404 });
  }
}
