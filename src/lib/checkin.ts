import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const secret = new TextEncoder().encode(`${process.env.JWT_SECRET || "training-attendance-secret-key"}:checkin`);
const DEVICE_COOKIE = "checkin_device";

export async function createDynamicQrToken(trainingId: number, qrVersion: string) {
  return new SignJWT({ trainingId, qrVersion, purpose: "checkin-qr" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("180s")
    .sign(secret);
}

export async function resolveDynamicQrToken(token: string) {
  const { payload } = await jwtVerify(token, secret);
  if (payload.purpose !== "checkin-qr") throw new Error("QR_EXPIRED");
  const training = await prisma.training.findUnique({ where: { id: Number(payload.trainingId) } });
  if (!training || training.qrToken !== payload.qrVersion) throw new Error("QR_EXPIRED");
  return training;
}

export function getCheckinWindow(training: { date: Date; startTime: string }) {
  const [hour, minute] = training.startTime.split(":").map(Number);
  const date = new Date(training.date);
  const start = new Date(Date.UTC(
    date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour - 8, minute, 0, 0
  ));
  return {
    opensAt: new Date(start.getTime() - 15 * 60 * 1000),
    closesAt: new Date(start.getTime() + 30 * 60 * 1000),
    lateAt: new Date(start.getTime() + 15 * 60 * 1000),
  };
}

export function assertCheckinOpen(training: { date: Date; startTime: string; status: string }) {
  if (training.status === "completed") throw new Error("TRAINING_ENDED");
  const now = new Date();
  const window = getCheckinWindow(training);
  // Starting a training in the admin portal explicitly opens check-in,
  // regardless of the originally scheduled start time.
  if (training.status === "ongoing") return window;
  if (now < window.opensAt) throw new Error("CHECKIN_NOT_OPEN");
  if (now > window.closesAt) throw new Error("CHECKIN_CLOSED");
  return window;
}

export async function createDeviceToken(employeeId: number, deviceId: string) {
  return new SignJWT({ employeeId, deviceId, purpose: "checkin-device" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("90d")
    .sign(secret);
}

export async function getBoundDevice() {
  const cookieStore = await cookies();
  const token = cookieStore.get(DEVICE_COOKIE)?.value;
  if (!token) throw new Error("DEVICE_BIND_REQUIRED");
  const { payload } = await jwtVerify(token, secret);
  if (payload.purpose !== "checkin-device") throw new Error("DEVICE_BIND_REQUIRED");
  const binding = await prisma.deviceBinding.findUnique({ where: { employeeId: Number(payload.employeeId) }, include: { employee: { include: { department: true } } } });
  if (!binding || binding.deviceId !== payload.deviceId || binding.expiresAt < new Date()) throw new Error("DEVICE_BIND_REQUIRED");
  return binding;
}

export const deviceCookie = { name: DEVICE_COOKIE, maxAge: 60 * 60 * 24 * 90 };

export function requestMeta(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return {
    ip: forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null,
    userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
  };
}
