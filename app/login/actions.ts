"use server";

import { redirect } from "next/navigation";
import { clearUserSession, createUserSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export type AuthFormState = {
  message: string;
  status: "idle" | "error";
};

export async function createFirstUser(
  _previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const credentials = parseCredentials(formData);
  if (!credentials.ok) return credentials.state;

  const { confirmPassword, password, username } = credentials;
  const nextPath = getSafeRedirectPath(formData.get("next"));

  if (password !== confirmPassword) {
    return {
      status: "error",
      message: "Las contraseñas no coinciden."
    };
  }

  const userCount = await prisma.appUser.count();
  if (userCount > 0) {
    return {
      status: "error",
      message: "Ya existe un usuario. Inicia sesión para continuar."
    };
  }

  const user = await prisma.appUser.create({
    data: {
      passwordHash: await hashPassword(password),
      username
    },
    select: { id: true }
  });

  await createUserSession(user.id);
  redirect(nextPath);
}

export async function loginUser(
  _previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const credentials = parseCredentials(formData);
  if (!credentials.ok) return credentials.state;

  const { password, username } = credentials;
  const nextPath = getSafeRedirectPath(formData.get("next"));

  const user = await prisma.appUser.findUnique({
    where: { username },
    select: {
      id: true,
      passwordHash: true
    }
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return {
      status: "error",
      message: "Usuario o contraseña incorrectos."
    };
  }

  await createUserSession(user.id);
  redirect(nextPath);
}

export async function logoutUser(): Promise<void> {
  await clearUserSession();
  redirect("/login");
}

type ParsedCredentials =
  | {
      confirmPassword: string;
      ok: true;
      password: string;
      username: string;
    }
  | {
      ok: false;
      state: AuthFormState;
    };

function parseCredentials(formData: FormData): ParsedCredentials {
  const rawUsername = formData.get("username");
  const rawPassword = formData.get("password");
  const rawConfirmPassword = formData.get("confirmPassword");

  if (typeof rawUsername !== "string" || rawUsername.trim().length < 3) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "El usuario debe tener al menos 3 caracteres."
      }
    };
  }

  if (typeof rawPassword !== "string" || rawPassword.length < 8) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "La contraseña debe tener al menos 8 caracteres."
      }
    };
  }

  if (
    rawConfirmPassword !== null &&
    (typeof rawConfirmPassword !== "string" || rawConfirmPassword.length < 8)
  ) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "La confirmación debe tener al menos 8 caracteres."
      }
    };
  }

  return {
    confirmPassword:
      typeof rawConfirmPassword === "string" ? rawConfirmPassword : "",
    ok: true,
    password: rawPassword,
    username: rawUsername.trim().toLowerCase()
  };
}

function getSafeRedirectPath(value: FormDataEntryValue | null): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }

  if (value.startsWith("/login")) {
    return "/";
  }

  return value;
}
