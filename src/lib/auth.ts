import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  verifySessionToken
} from "@/lib/session";

export async function createUserSession(userId: string): Promise<void> {
  const token = await createSessionToken(userId);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
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

  return prisma.appUser.findUnique({
    where: { id: session.userId },
    select: {
      createdAt: true,
      id: true,
      username: true
    }
  });
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return user;
}
