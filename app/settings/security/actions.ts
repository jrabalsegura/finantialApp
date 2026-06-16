"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export type SecurityFormState = {
  message: string;
  status: "idle" | "success" | "error";
};

export async function changePassword(
  _previousState: SecurityFormState,
  formData: FormData
): Promise<SecurityFormState> {
  const currentUser = await requireCurrentUser();
  const currentPassword = parseRequiredPassword(
    formData.get("currentPassword"),
    "Introduce tu contraseña actual."
  );
  const newPassword = parseRequiredPassword(
    formData.get("newPassword"),
    "La nueva contraseña debe tener al menos 8 caracteres."
  );
  const confirmPassword = parseRequiredPassword(
    formData.get("confirmPassword"),
    "Repite la nueva contraseña."
  );

  if (isSecurityFormState(currentPassword)) return currentPassword;
  if (isSecurityFormState(newPassword)) return newPassword;
  if (isSecurityFormState(confirmPassword)) return confirmPassword;

  if (newPassword !== confirmPassword) {
    return {
      status: "error",
      message: "Las contraseñas no coinciden."
    };
  }

  const user = await prisma.appUser.findUnique({
    where: { id: currentUser.id },
    select: { passwordHash: true }
  });

  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return {
      status: "error",
      message: "La contraseña actual no es correcta."
    };
  }

  await prisma.appUser.update({
    where: { id: currentUser.id },
    data: {
      passwordHash: await hashPassword(newPassword)
    }
  });

  revalidatePath("/settings/security");

  return {
    status: "success",
    message: "Contraseña actualizada."
  };
}

export async function createAdditionalUser(
  _previousState: SecurityFormState,
  formData: FormData
): Promise<SecurityFormState> {
  await requireCurrentUser();

  const username = parseUsername(formData.get("username"));
  const password = parseRequiredPassword(
    formData.get("password"),
    "La contraseña debe tener al menos 8 caracteres."
  );
  const confirmPassword = parseRequiredPassword(
    formData.get("confirmPassword"),
    "Repite la contraseña."
  );

  if (isSecurityFormState(username)) return username;
  if (isSecurityFormState(password)) return password;
  if (isSecurityFormState(confirmPassword)) return confirmPassword;

  if (password !== confirmPassword) {
    return {
      status: "error",
      message: "Las contraseñas no coinciden."
    };
  }

  const existingUser = await prisma.appUser.findUnique({
    where: { username },
    select: { id: true }
  });

  if (existingUser) {
    return {
      status: "error",
      message: "Ya existe un usuario con ese nombre."
    };
  }

  await prisma.appUser.create({
    data: {
      passwordHash: await hashPassword(password),
      username
    }
  });

  revalidatePath("/settings/security");

  return {
    status: "success",
    message: "Usuario creado."
  };
}

function parseUsername(
  value: FormDataEntryValue | null
): string | SecurityFormState {
  if (typeof value !== "string" || value.trim().length < 3) {
    return {
      status: "error",
      message: "El usuario debe tener al menos 3 caracteres."
    };
  }

  return value.trim().toLowerCase();
}

function parseRequiredPassword(
  value: FormDataEntryValue | null,
  message: string
): string | SecurityFormState {
  if (typeof value !== "string" || value.length < 8) {
    return {
      status: "error",
      message
    };
  }

  return value;
}

function isSecurityFormState(
  value: string | SecurityFormState
): value is SecurityFormState {
  return typeof value !== "string";
}
