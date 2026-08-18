import { jwtVerify } from "jose";

export const AUTH_SESSION_VERSION = 2;

export type SessionPayload = {
  id: number;
  username: string;
  role: "admin" | "employee";
  sessionVersion?: number;
};

export async function verifySessionToken(token: string): Promise<SessionPayload> {
  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET || "training-attendance-secret-key",
  );
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ["HS256"],
  });
  const session = payload as unknown as SessionPayload;
  if (
    session.sessionVersion !== AUTH_SESSION_VERSION
    || (session.role !== "admin" && session.role !== "employee")
  ) {
    throw new Error("Invalid session");
  }
  return session;
}
