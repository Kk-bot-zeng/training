const INTRANET_ORIGIN = "http://10.68.208.188:8080";

function normalizeOrigin(origin: string) {
  try {
    const parsed = new URL(origin);
    if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) return INTRANET_ORIGIN;
    return parsed.origin;
  } catch {
    return INTRANET_ORIGIN;
  }
}

export function getBrowserAccessOrigin() {
  return typeof window === "undefined" ? "" : normalizeOrigin(window.location.origin);
}

export function getRequestAccessOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || "";
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || (host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("172.") ? "http" : "https");
  return normalizeOrigin(`${protocol}://${host}`);
}
