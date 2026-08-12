import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { getAuthAdmin } from "@/lib/auth";
import { createDynamicQrToken } from "@/lib/checkin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthAdmin();
    const { id } = await params;
    const training = await prisma.training.findUnique({ where: { id: parseInt(id) } });
    if (!training) return NextResponse.json({ success: false, message: "培训不存在" }, { status: 404 });
    const token = await createDynamicQrToken(training.id, training.qrToken);
    const requestedOrigin = request.nextUrl.searchParams.get("origin");
    const allowedOrigins = new Set([process.env.NEXT_PUBLIC_BASE_URL, "http://10.68.208.188:8080"].filter(Boolean));
    const baseUrl = requestedOrigin && allowedOrigins.has(requestedOrigin) ? requestedOrigin : process.env.NEXT_PUBLIC_BASE_URL;
    return NextResponse.json({
      success: true,
      data: { token, checkinUrl: `${baseUrl}/checkin/${token}`, expiresIn: 90 },
    });
  } catch (error) {
    console.error("Get dynamic QR error:", error);
    return NextResponse.json({ success: false, message: "生成动态二维码失败" }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthAdmin();
    const { id } = await params;
    const qrToken = randomUUID();

    const training = await prisma.training.update({
      where: { id: parseInt(id) },
      data: { qrToken },
    });

    return NextResponse.json({
      success: true,
      data: {
        qrToken,
        checkinUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/checkin/${qrToken}`,
      },
    });
  } catch (error) {
    console.error("Regenerate QR error:", error);
    return NextResponse.json(
      { success: false, message: "重新生成二维码失败" },
      { status: 500 }
    );
  }
}
