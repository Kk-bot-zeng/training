import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { getRequestAccessOrigin } from "@/lib/access-origin";

function safeNextPath(value: FormDataEntryValue | null, role: "admin" | "employee") {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : role === "admin" ? "/admin" : "/portal";
}

function loginRedirect(request: NextRequest, path: string) {
  return new URL(path, getRequestAccessOrigin(request));
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  const submittedNext = form.get("next");
  const referer = request.headers.get("referer");
  const refererNext = referer ? new URL(referer).searchParams.get("next") : null;
  const next = typeof submittedNext === "string" && submittedNext ? submittedNext : refererNext;
  if (!username || !password) {
    return NextResponse.redirect(loginRedirect(request, `/login?error=${encodeURIComponent("请输入账号和密码")}`), 303);
  }

  const admin = await prisma.admin.findUnique({ where: { username } });
  let role: "admin" | "employee";
  let id: number;
  let displayName: string;
  if (admin && await bcrypt.compare(password, admin.passwordHash)) {
    role = "admin";
    id = admin.id;
    displayName = admin.username;
  } else {
    const candidates = await prisma.employee.findMany({
      where: { OR: [{ employeeNo: username }, { name: username }], status: "active", passwordHash: { not: null } },
      select: { id: true, name: true, passwordHash: true },
    });
    const matches = (await Promise.all(candidates.map(async (candidate) =>
      candidate.passwordHash && await bcrypt.compare(password, candidate.passwordHash) ? candidate : null
    ))).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
    if (!matches.length) {
      const target = loginRedirect(request, "/login");
      target.searchParams.set("error", "账号或密码错误");
      if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) target.searchParams.set("next", next);
      return NextResponse.redirect(target, 303);
    }
    role = "employee";
    id = matches[0].id;
    displayName = matches[0].name;
  }

  const token = await signToken({ id, username: displayName, role });
  const response = NextResponse.redirect(loginRedirect(request, safeNextPath(next, role)), 303);
  const publicOrigin = getRequestAccessOrigin(request);
  response.cookies.set("token", token, {
    httpOnly: true,
    secure: publicOrigin.startsWith("https://"),
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
