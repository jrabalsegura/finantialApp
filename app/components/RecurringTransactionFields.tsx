"use client";

import { useMemo, useState } from "react";

type RecurringType =
  | "expense"
  | "income"
  | "transfer"
  | "savings_allocation";
type RecurringFrequency = "monthly" | "weekly";

type AccountOption = {
  id: string;
  name: string;
};

type CategoryOption = {
  id: string;
  name: string;
  type: "expense" | "income" | "both";
};

type SavingsBucketOption = {
  id: string;
  name: string;
};

type RecurringTransactionFieldsProps = {
  accounts: AccountOption[];
  categories: CategoryOption[];
  defaultAccountId: string;
  savingsBuckets: SavingsBucketOption[];
  template?: {
    accountId: string;
    amount: number;
    autoCreateMode: "pending" | "automatic";
    categoryId: string | null;
    dayOfMonth: number;
    dayOfWeek: number;
    description: string | null;
    destinationAccountId: string | null;
    endDate: string;
    frequency: RecurringFrequency;
    isActive: boolean;
    name: string;
    savingsBucketId: string | null;
    startDate: string;
    type: RecurringType;
  };
};

const typeOptions: Array<{ label: string; value: RecurringType }> = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Ingreso" },
  { value: "transfer", label: "Transferencia" },
  { value: "savings_allocation", label: "Asignación a ahorro" }
];

export function RecurringTransactionFields({
  accounts,
  categories,
  defaultAccountId,
  savingsBuckets,
  template
}: RecurringTransactionFieldsProps) {
  const [type, setType] = useState<RecurringType>(template?.type ?? "expense");
  const [frequency, setFrequency] = useState<RecurringFrequency>(
    template?.frequency ?? "monthly"
  );
  const [accountId, setAccountId] = useState(
    template?.accountId ?? defaultAccountId
  );
  const availableCategories = useMemo(
    () =>
      categories.filter(
        (category) => category.type === "both" || category.type === type
      ),
    [categories, type]
  );
  const destinationAccounts = accounts.filter(
    (account) => account.id !== accountId
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="field-label sm:col-span-2">
          Nombre
          <input
            className="field-input"
            defaultValue={template?.name}
            name="name"
            placeholder="Nómina, alquiler, Netflix..."
            required
            type="text"
          />
        </label>

        <label className="field-label">
          Tipo
          <select
            className="field-input"
            name="type"
            onChange={(event) => {
              const nextType = event.target.value as RecurringType;
              setType(nextType);
              if (
                nextType === "transfer" ||
                nextType === "savings_allocation"
              ) {
                setFrequency("monthly");
              }
            }}
            value={type}
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-label">
          Importe habitual
          <input
            className="field-input"
            defaultValue={
              template && template.amount > 0 ? template.amount : undefined
            }
            min="0.01"
            name="amount"
            required
            step="0.01"
            type="number"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="field-label">
          Cuenta origen
          <select
            className="field-input"
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

        {type === "transfer" ? (
          <label className="field-label">
            Cuenta destino
            <select
              className="field-input"
              defaultValue={template?.destinationAccountId ?? ""}
              name="destinationAccountId"
              required
            >
              <option disabled value="">
                Selecciona destino
              </option>
              {destinationAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {type === "expense" || type === "income" ? (
          <label className="field-label">
            Categoría
            <select
              className="field-input"
              defaultValue={template?.categoryId ?? ""}
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
        ) : null}

        {type === "savings_allocation" ? (
          <label className="field-label">
            Partida de ahorro
            <select
              className="field-input"
              defaultValue={template?.savingsBucketId ?? ""}
              name="savingsBucketId"
              required
            >
              <option disabled value="">
                Selecciona partida
              </option>
              {savingsBuckets.map((bucket) => (
                <option key={bucket.id} value={bucket.id}>
                  {bucket.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="field-label">
          Frecuencia
          <select
            className="field-input"
            name="frequency"
            onChange={(event) =>
              setFrequency(event.target.value as RecurringFrequency)
            }
            value={frequency}
          >
            <option value="monthly">Mensual</option>
            {type === "expense" || type === "income" ? (
              <option value="weekly">Semanal</option>
            ) : null}
          </select>
        </label>

        {frequency === "monthly" ? (
          <label className="field-label">
            Día del mes
            <input
              className="field-input"
              defaultValue={template?.dayOfMonth ?? 1}
              max="31"
              min="1"
              name="dayOfMonth"
              required
              type="number"
            />
          </label>
        ) : (
          <label className="field-label">
            Día de la semana
            <select
              className="field-input"
              defaultValue={template?.dayOfWeek ?? 1}
              name="dayOfWeek"
              required
            >
              <option value="1">Lunes</option>
              <option value="2">Martes</option>
              <option value="3">Miércoles</option>
              <option value="4">Jueves</option>
              <option value="5">Viernes</option>
              <option value="6">Sábado</option>
              <option value="7">Domingo</option>
            </select>
          </label>
        )}

        <label className="field-label">
          Modo
          <select
            className="field-input"
            defaultValue={template?.autoCreateMode ?? "pending"}
            name="autoCreateMode"
          >
            <option value="pending">Pendiente para revisar</option>
            <option value="automatic">Crear automáticamente</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="field-label">
          Fecha de inicio
          <input
            className="field-input"
            defaultValue={template?.startDate}
            name="startDate"
            required
            type="date"
          />
        </label>

        <label className="field-label">
          Fecha de fin
          <input
            className="field-input"
            defaultValue={template?.endDate}
            name="endDate"
            type="date"
          />
        </label>

        <label className="check-row self-end">
          <input
            defaultChecked={template?.isActive ?? true}
            name="isActive"
            type="checkbox"
          />
          Plantilla activa
        </label>
      </div>

      <label className="field-label">
        Descripción del movimiento
        <input
          className="field-input"
          defaultValue={template?.description ?? ""}
          name="description"
          placeholder="Opcional; se usará en el movimiento confirmado"
          type="text"
        />
      </label>
    </>
  );
}
