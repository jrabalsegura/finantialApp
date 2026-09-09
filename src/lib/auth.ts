import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  getSessionCookieOptions,
  REMEMBERED_SESSION_DURATION_SECONDS,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  verifySessionToken
} from "@/lib/session";

export async function createUserSession(
  userId: string,
  { remember = false }: { remember?: boolean } = {}
): Promise<void> {
  const durationSeconds = remember
    ? REMEMBERED_SESSION_DURATION_SECONDS
    : SESSION_DURATION_SECONDS;
  const user = await prisma.appUser.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } });
  const token = await createSessionToken(userId, durationSeconds, undefined, user.sessionVersion);
  const cookieStore = await cookies();

  cookieStore.set(
    SESSION_COOKIE_NAME,
    token,
    getSessionCookieOptions(durationSeconds)
  );
}

export async function clearUserSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  if (!session) return null;

  const user = await prisma.appUser.findUnique({
    where: { id: session.userId },
    select: {
      sessionVersion: true,
      createdAt: true,
      id: true,
      username: true
    }
  });
  return user && user.sessionVersion === session.sessionVersion ? user : null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return user;
}
