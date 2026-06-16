"use client";

import { useActionState, type KeyboardEvent } from "react";
import {
  createFirstUser,
  loginUser,
  type AuthFormState
} from "./actions";

const INITIAL_STATE: AuthFormState = {
  status: "idle",
  message: ""
};

export function LoginForm({
  hasUsers,
  nextPath
}: {
  hasUsers: boolean;
  nextPath: string;
}) {
  const action = hasUsers ? loginUser : createFirstUser;
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    if (event.target instanceof HTMLTextAreaElement) {
      return;
    }

    event.preventDefault();
    event.currentTarget.requestSubmit();
  }

  return (
    <form action={formAction} className="grid gap-4" onKeyDown={handleKeyDown}>
      <input name="next" type="hidden" value={nextPath} />

      <label className="field-label">
        Usuario
        <input
          autoComplete="username"
          autoFocus
          className="field-input"
          minLength={3}
          name="username"
          required
          type="text"
        />
      </label>

      <label className="field-label">
        Contraseña
        <input
          autoComplete={hasUsers ? "current-password" : "new-password"}
          className="field-input"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>

      {hasUsers ? null : (
        <label className="field-label">
          Repetir contraseña
          <input
            autoComplete="new-password"
            className="field-input"
            minLength={8}
            name="confirmPassword"
            required
            type="password"
          />
        </label>
      )}

      {state.status === "error" ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {state.message}
        </p>
      ) : null}

      <button
        className="primary-button w-full"
        disabled={isPending}
        type="submit"
      >
        {isPending
          ? "Comprobando..."
          : hasUsers
            ? "Entrar"
            : "Crear usuario"}
      </button>
    </form>
  );
}
