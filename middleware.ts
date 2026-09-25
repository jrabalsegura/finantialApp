import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  getSessionCookieOptions,
  normalizeSessionDuration,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  verifySessionToken
} from "@/lib/session";

const PUBLIC_PATH_PREFIXES = [
  "/_next",
  "/api/health",
  "/favicon.ico",
  "/login"
];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value
  );

  // Node runtime lets the middleware check the DB, so a password change or a
  // deleted user revokes existing cookies on the very next request.
  const user = session
    ? await prisma.appUser.findUnique({
        where: { id: session.userId },
        select: { sessionVersion: true }
      })
    : null;

  if (session && user && user.sessionVersion === session.sessionVersion) {
    const response = NextResponse.next();
    const durationSeconds = normalizeSessionDuration(
      session.durationSeconds ?? SESSION_DURATION_SECONDS
    );
    const refreshedToken = await createSessionToken(
      session.userId,
      durationSeconds,
      undefined,
      session.sessionVersion
    );

    response.cookies.set(
      SESSION_COOKIE_NAME,
      refreshedToken,
      getSessionCookieOptions(durationSeconds)
    );

    return response;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Inicia sesión para continuar." },
      { status: 401 }
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
