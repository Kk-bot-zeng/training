import { SignJWT } from "jose";
import { cookies } from "next/headers";
import {
  AUTH_SESSION_VERSION,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/session";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "training-attendance-secret-key"
);

export type AuthPayload = SessionPayload;

export async function signToken(payload: AuthPayload): Promise<string> {
  return new SignJWT({ ...payload, sessionVersion: AUTH_SESSION_VERSION })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<AuthPayload> {
  return verifySessionToken(token);
}

export async function getAuthAdmin(): Promise<AuthPayload> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) throw new Error("Unauthorized");
  const payload = await verifyToken(token);
  if (payload.role !== "admin") throw new Error("Forbidden");
  return payload;
}

export async function getAuthUser(): Promise<AuthPayload> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) throw new Error("Unauthorized");
  return await verifyToken(token);
}
