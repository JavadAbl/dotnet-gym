import { NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, accessCookieOptions, refreshCookieOptions, type SessionUser } from "@/lib/auth-cookies";
import { backendFetch, readBackendError } from "@/lib/backend";

interface BackendAuthResponse {
  user: { id: string; fullName: string; roles: string[] };
  accessToken: string;
  refreshToken: string;
}

export async function POST(request: Request) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ errorCode: "AUTH_INVALID_REFRESH_TOKEN" }, { status: 401 });
  }

  const response = await backendFetch("/api/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    const error = await readBackendError(response);
    const result = NextResponse.json({ errorCode: error.errorCode }, { status: error.status });
    result.cookies.delete(ACCESS_COOKIE);
    result.cookies.delete(REFRESH_COOKIE);
    return result;
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
