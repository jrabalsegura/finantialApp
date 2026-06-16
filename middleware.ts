import { NextResponse, type NextRequest } from "next/server";
import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  verifySessionToken
} from "@/lib/session";

const PUBLIC_PATH_PREFIXES = ["/_next", "/favicon.ico", "/login"];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value
  );

  if (session) {
    const response = NextResponse.next();
    const refreshedToken = await createSessionToken(session.userId);

    response.cookies.set(
      SESSION_COOKIE_NAME,
      refreshedToken,
      getSessionCookieOptions()
    );

    return response;
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/api/:path*"]
};

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
