import { NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";

export async function POST(request: Request) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  // Best-effort server-side revocation; cookies are cleared regardless.
  if (refreshToken) {
    await backendFetch("/api/v1/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      timeoutMs: 3000,
    });
  }

  const result = NextResponse.json({ ok: true });
  result.cookies.delete(ACCESS_COOKIE);
  result.cookies.delete(REFRESH_COOKIE);
  return result;
}
