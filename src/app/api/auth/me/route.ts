import { NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, accessCookieOptions, refreshCookieOptions, type SessionUser } from "@/lib/auth-cookies";
import { backendFetch, readBackendError } from "@/lib/backend";

interface BackendMeResponse {
  id: string;
  fullName: string;
  roles: string[];
  branchId: string | null;
}

export async function GET(request: Request) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;

  if (accessToken) {
    const response = await backendFetch("/api/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.ok) {
      const me = (await response.json()) as BackendMeResponse;
      return NextResponse.json({ user: me satisfies SessionUser });
    }

    if (response.status !== 401) {
      const error = await readBackendError(response);
      return NextResponse.json({ errorCode: error.errorCode }, { status: error.status });
    }
  }

  // Access token missing/expired — try one silent refresh.
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    const result = NextResponse.json({ errorCode: "AUTH_UNAUTHENTICATED" }, { status: 401 });
    result.cookies.delete(ACCESS_COOKIE);
    result.cookies.delete(REFRESH_COOKIE);
    return result;
  }

  const refreshResponse = await backendFetch("/api/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });

  if (!refreshResponse.ok) {
    const error = await readBackendError(refreshResponse);
    const result = NextResponse.json({ errorCode: error.errorCode }, { status: error.status });
    result.cookies.delete(ACCESS_COOKIE);
    result.cookies.delete(REFRESH_COOKIE);
    return result;
  }

  const auth = (await refreshResponse.json()) as {
    user: { id: string; fullName: string; roles: string[] };
    accessToken: string;
    refreshToken: string;
  };

  const result = NextResponse.json({
    user: {
      id: auth.user.id,
      fullName: auth.user.fullName,
      roles: auth.user.roles,
      branchId: null,
    } satisfies SessionUser,
  });
  result.cookies.set(ACCESS_COOKIE, auth.accessToken, accessCookieOptions);
  result.cookies.set(REFRESH_COOKIE, auth.refreshToken, refreshCookieOptions);
  return result;
}
