import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "training-attendance-secret-key"
);

export interface AdminPayload {
  id: number;
  username: string;
}

export async function signToken(payload: AdminPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<AdminPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as AdminPayload;
}

export async function getAuthAdmin(): Promise<AdminPayload> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) throw new Error("Unauthorized");

  try {
    return await verifyToken(token);
  } catch {
    throw new Error("Token expired");
  }
}
