import { NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, accessCookieOptions, refreshCookieOptions, type SessionUser } from "@/lib/auth-cookies";
import { backendFetch, readBackendError } from "@/lib/backend";

interface BackendAuthResponse {
  user: { id: string; userName: string | null; fullName: string; phone: string | null; roles: string[] };
  accessToken: string;
  expiresAtUtc: string;
  refreshToken: string;
}

export async function POST(request: Request) {
  let payload: { userName?: string; password?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ errorCode: "GENERIC" }, { status: 400 });
  }

  const response = await backendFetch("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ userName: payload.userName ?? "", password: payload.password ?? "" }),
  });

  if (!response.ok) {
    const error = await readBackendError(response);
    return NextResponse.json({ errorCode: error.errorCode }, { status: error.status });
  }

  const auth = (await response.json()) as BackendAuthResponse;
  const user: SessionUser = {
    id: auth.user.id,
    fullName: auth.user.fullName,
    roles: auth.user.roles,
    branchId: null,
  };

  const result = NextResponse.json({ user });
  result.cookies.set(ACCESS_COOKIE, auth.accessToken, accessCookieOptions);
  result.cookies.set(REFRESH_COOKIE, auth.refreshToken, refreshCookieOptions);
  return result;
}
