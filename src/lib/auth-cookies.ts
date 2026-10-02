/** httpOnly cookie names + options for the BFF auth bridge. Tokens never touch client JS. */
export const ACCESS_COOKIE = "gms_at";
export const REFRESH_COOKIE = "gms_rt";

export const accessCookieOptions = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 12, // 12h — matches backend access token lifetime (120 min) with headroom
};

export const refreshCookieOptions = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days — matches backend refresh lifetime
};

export type SessionUser = {
  id: string;
  fullName: string;
  roles: string[];
  branchId: string | null;
};
