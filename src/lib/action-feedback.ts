import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";

export const FLASH_COOKIE_NAME = "financial_app_flash";

const GENERIC_ERROR = "No se pudo completar la operación.";

/**
 * Business rules throw plain `Error`s with a message meant for the user.
 * Anything else (Prisma, runtime) is logged and replaced by a generic text so
 * internal details never reach the page.
 */
export function getActionErrorMessage(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return "Ya existe un registro con ese nombre.";
    if (error.code === "P2025") {
      return "El registro ya no existe. Recarga la página.";
    }
  }
  if (error instanceof Error && !error.name.startsWith("PrismaClient")) {
    return error.message;
  }
  console.error(error);
  return GENERIC_ERROR;
}

/**
 * Wraps a `<form action>` server action. In production Next.js hides the
 * message of any error thrown by an action and shows a crash page, so errors
 * are stored in a short-lived cookie that the root layout renders as a banner.
 */
export function withErrorFeedback(
  action: (formData: FormData) => Promise<void>
): (formData: FormData) => Promise<void> {
  return async (formData) => {
    try {
      await action(formData);
    } catch (error) {
      unstable_rethrow(error);
      (await cookies()).set(
        FLASH_COOKIE_NAME,
        `${Date.now()}|${getActionErrorMessage(error)}`,
        { maxAge: 60, path: "/", sameSite: "lax" }
      );
    }
  };
}
