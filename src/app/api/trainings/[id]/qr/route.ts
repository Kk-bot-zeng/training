import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
