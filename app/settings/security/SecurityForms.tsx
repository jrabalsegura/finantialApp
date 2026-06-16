"use client";

import { useActionState } from "react";
import {
  changePassword,
  createAdditionalUser,
  type SecurityFormState
} from "./actions";

const INITIAL_STATE: SecurityFormState = {
  status: "idle",
  message: ""
};

export function SecurityForms() {
  const [passwordState, passwordAction, isChangingPassword] = useActionState(
    changePassword,
    INITIAL_STATE
  );
  const [userState, userAction, isCreatingUser] = useActionState(
    createAdditionalUser,
    INITIAL_STATE
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        action={passwordAction}
        className="grid gap-5 rounded-lg border border-line bg-white p-4 shadow-sm sm:p-6"
      >
        <div>
          <h2 className="text-lg font-semibold text-ink">
            Cambiar contraseña
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            La nueva contraseña se aplicará al usuario con el que has iniciado
            sesión.
          </p>
        </div>

        <label className="field-label">
          Contraseña actual
          <input
            autoComplete="current-password"
            className="field-input"
            minLength={8}
            name="currentPassword"
            required
            type="password"
          />
        </label>

        <label className="field-label">
          Nueva contraseña
          <input
            autoComplete="new-password"
            className="field-input"
            minLength={8}
            name="newPassword"
            required
            type="password"
          />
        </label>

        <label className="field-label">
          Repetir nueva contraseña
          <input
            autoComplete="new-password"
            className="field-input"
            minLength={8}
            name="confirmPassword"
            required
            type="password"
          />
        </label>

        <FormMessage state={passwordState} />

        <button
          className="primary-button w-full sm:w-fit"
          disabled={isChangingPassword}
          type="submit"
        >
          {isChangingPassword ? "Guardando..." : "Actualizar contraseña"}
        </button>
      </form>

      <form
        action={userAction}
        className="grid gap-5 rounded-lg border border-line bg-white p-4 shadow-sm sm:p-6"
      >
        <div>
          <h2 className="text-lg font-semibold text-ink">Crear usuario</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Añade otro acceso para la app. Todos los usuarios pueden entrar a
            las mismas finanzas.
          </p>
        </div>

        <label className="field-label">
          Usuario
          <input
            autoComplete="username"
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
            autoComplete="new-password"
            className="field-input"
            minLength={8}
            name="password"
            required
            type="password"
          />
        </label>

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

        <FormMessage state={userState} />

        <button
          className="primary-button w-full sm:w-fit"
          disabled={isCreatingUser}
          type="submit"
        >
          {isCreatingUser ? "Creando..." : "Crear usuario"}
        </button>
      </form>
    </div>
  );
}

function FormMessage({ state }: { state: SecurityFormState }) {
  if (state.status === "idle") return null;

  const className =
    state.status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <p
      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${className}`}
    >
      {state.message}
    </p>
  );
}
