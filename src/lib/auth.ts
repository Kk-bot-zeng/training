import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "training-attendance-secret-key"
);

export interface AuthPayload {
  id: number;
  username: string;
  role: "admin" | "employee";
}

export async function signToken(payload: AuthPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<AuthPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as AuthPayload;
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
