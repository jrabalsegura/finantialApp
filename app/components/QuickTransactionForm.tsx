"use client";

import { useActionState, useMemo, useState } from "react";
import type {
  TransactionFormState,
  createQuickTransaction
} from "../actions";
import type { QuickTransactionType } from "@/domain/transaction-rules";

type AccountOption = {
  id: string;
  name: string;
};

type CategoryOption = {
  id: string;
  name: string;
  type: "expense" | "income" | "both";
};

type QuickTransactionFormProps = {
  accounts: AccountOption[];
  categories: CategoryOption[];
  defaultAccountId: string;
  today: string;
  action: typeof createQuickTransaction;
};

const initialState: TransactionFormState = {
  status: "idle",
  message: ""
};

const transactionModes: Array<{
  type: QuickTransactionType;
  label: string;
  tone: string;
}> = [
  {
    type: "expense",
    label: "Añadir gasto",
    tone: "border-rose-200 bg-rose-50 text-rose-900"
  },
  {
    type: "income",
    label: "Añadir ingreso",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900"
  },
  {
    type: "transfer",
    label: "Añadir transferencia",
    tone: "border-sky-200 bg-sky-50 text-sky-900"
  }
];

export function QuickTransactionForm({
  accounts,
  categories,
  defaultAccountId,
  today,
  action
}: QuickTransactionFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [mode, setMode] = useState<QuickTransactionType>("expense");
  const [accountId, setAccountId] = useState(defaultAccountId);

  const availableCategories = useMemo(
    () =>
      categories.filter(
        (category) => category.type === "both" || category.type === mode
      ),
    [categories, mode]
  );

  const destinationAccounts = accounts.filter(
    (account) => account.id !== accountId
  );

  const selectedMode = transactionModes.find((item) => item.type === mode);

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-sm sm:p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {transactionModes.map((item) => {
          const isSelected = item.type === mode;

          return (
            <button
              aria-pressed={isSelected}
              className={`min-h-20 rounded-lg border px-4 py-4 text-left text-base font-semibold transition ${
                isSelected
                  ? `${item.tone} ring-2 ring-ink`
                  : "border-line bg-surface text-ink"
              }`}
              key={item.type}
              onClick={() => setMode(item.type)}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <form action={formAction} className="mt-5 grid gap-4">
        <input name="type" type="hidden" value={mode} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Importe
            <input
              className="h-12 rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-accent"
              inputMode="decimal"
              min="0.01"
              name="amount"
              placeholder="0,00"
              required
              step="0.01"
              type="number"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Fecha
            <input
              className="h-12 rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-accent"
              defaultValue={today}
              name="date"
              required
              type="date"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Cuenta
            <select
              className="h-12 rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-accent"
              name="accountId"
              onChange={(event) => setAccountId(event.target.value)}
              required
              value={accountId}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          {mode === "transfer" ? (
            <label className="grid gap-2 text-sm font-medium text-ink">
              Destino
              <select
                className="h-12 rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-accent"
                name="destinationAccountId"
                required
              >
                {destinationAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="grid gap-2 text-sm font-medium text-ink">
              Categoría
              <select
                className="h-12 rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-accent"
                name="categoryId"
              >
                <option value="">Sin categoría</option>
                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <label className="grid gap-2 text-sm font-medium text-ink">
          Descripción
          <input
            className="h-12 rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-accent"
            name="description"
            placeholder={
              selectedMode?.type === "transfer" ? "Entre cuentas" : "Concepto"
            }
            type="text"
          />
        </label>

        <button
          className="min-h-14 rounded-lg bg-ink px-5 py-3 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending || accounts.length === 0}
          type="submit"
        >
          {isPending ? "Guardando..." : selectedMode?.label}
        </button>

        {state.message ? (
          <p
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              state.status === "success"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-rose-50 text-rose-800"
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
