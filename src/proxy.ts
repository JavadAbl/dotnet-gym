import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth-cookies";

/**
 * Auth route guard (BFF cookie model — tokens are verified by the ASP.NET backend,
 * proxy only does a cheap presence check for redirects).
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const hasAccess = !!request.cookies.get(ACCESS_COOKIE)?.value;
    const hasRefresh = !!request.cookies.get(REFRESH_COOKIE)?.value;

    if (!hasAccess && !hasRefresh) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
